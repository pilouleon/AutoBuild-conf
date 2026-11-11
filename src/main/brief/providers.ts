// Fournisseurs du moteur de brief : Claude, Gemini, ou scénario rejoué (démo sans clé).
// Tous renvoient un BriefPatch ; la validation des preuves est faite ensuite par applyPatch().

import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { GoogleGenAI } from '@google/genai'
import { z } from 'zod'
import { briefSystemPrompt, briefUserInstruction, formatSegments } from '@shared/brief/prompt'
import { type Brief, type BriefPatch, BriefPatchSchema } from '@shared/brief/schema'
import type { TranscriptSegment } from '@shared/types'
import { type ClaudeCli, claudeStructured } from '../claude-code/cli'
import type { Scenario } from '../transcription/scenario'

export interface BriefInput {
  brief: Brief
  segments: TranscriptSegment[]
  newSegmentIds: string[]
}

export interface BriefProviderImpl {
  readonly name: string
  update(input: BriefInput, signal?: AbortSignal): Promise<BriefPatch>
}

const SYSTEM = briefSystemPrompt()

export class ClaudeBriefProvider implements BriefProviderImpl {
  readonly name: string
  private client: Anthropic

  constructor(
    apiKey: string,
    private model: string,
    private effort: 'low' | 'medium' | 'high'
  ) {
    this.client = new Anthropic({ apiKey })
    this.name = `Claude (${model})`
  }

  async update(input: BriefInput, signal?: AbortSignal): Promise<BriefPatch> {
    const response = await this.client.beta.messages.parse(
      {
        model: this.model,
        max_tokens: 16000,
        // Si le modèle décline la requête, l'API la rejoue sur le modèle de repli recommandé.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: this.effort, format: betaZodOutputFormat(BriefPatchSchema) },
        // Partie stable mise en cache : consignes + grille + catalogue.
        system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
        messages: [
          {
            role: 'user',
            content: [
              // Le transcript ne fait que s'allonger : le point de cache est posé dessus.
              { type: 'text', text: `TRANSCRIPTION\n${formatSegments(input.segments)}`, cache_control: { type: 'ephemeral' } },
              { type: 'text', text: briefUserInstruction(input.brief, input.newSegmentIds) }
            ]
          }
        ]
      },
      { signal }
    )
    if (response.stop_reason === 'refusal') {
      throw new Error('Claude a décliné la requête (refusal).')
    }
    if (response.stop_reason === 'max_tokens') {
      throw new Error('Réponse tronquée (max_tokens).')
    }
    if (!response.parsed_output) throw new Error('Réponse de Claude non conforme au schéma.')
    return response.parsed_output
  }
}

export class GeminiBriefProvider implements BriefProviderImpl {
  readonly name: string
  private ai: GoogleGenAI
  private jsonSchema = z.toJSONSchema(BriefPatchSchema)

  constructor(
    apiKey: string,
    private model: string
  ) {
    this.ai = new GoogleGenAI({ apiKey })
    this.name = `Gemini (${model})`
  }

  async update(input: BriefInput, signal?: AbortSignal): Promise<BriefPatch> {
    const res = await this.ai.models.generateContent({
      model: this.model,
      contents: [
        {
          role: 'user',
          parts: [{ text: `TRANSCRIPTION\n${formatSegments(input.segments)}` }, { text: briefUserInstruction(input.brief, input.newSegmentIds) }]
        }
      ],
      config: {
        systemInstruction: SYSTEM,
        responseMimeType: 'application/json',
        responseJsonSchema: this.jsonSchema,
        temperature: 0.1,
        abortSignal: signal
      }
    })
    const text = res.text
    if (!text) throw new Error('Réponse vide de Gemini.')
    return BriefPatchSchema.parse(JSON.parse(text))
  }
}

/** Brief par le Claude Code installé sur le poste (abonnement de l'utilisateur). */
export class ClaudeCodeBriefProvider implements BriefProviderImpl {
  readonly name: string
  private schema = z.toJSONSchema(BriefPatchSchema) as Record<string, unknown>

  constructor(
    private cli: ClaudeCli,
    private model: string,
    private effort: 'low' | 'medium' | 'high',
    private cwd: string
  ) {
    this.name = `Claude Code (${model})`
  }

  async update(input: BriefInput, signal?: AbortSignal): Promise<BriefPatch> {
    const { data } = await claudeStructured<unknown>({
      cli: this.cli,
      model: this.model,
      effort: this.effort,
      system: SYSTEM,
      prompt: `TRANSCRIPTION\n${formatSegments(input.segments)}\n\n${briefUserInstruction(input.brief, input.newSegmentIds)}`,
      schema: this.schema,
      cwd: this.cwd,
      timeoutMs: 180_000,
      signal
    })
    return BriefPatchSchema.parse(data)
  }
}

/** Rejoue les patchs écrits dans le scénario, au fil du transcript (démo sans clé API). */
export class ScenarioBriefProvider implements BriefProviderImpl {
  readonly name = 'Scénario (sans IA)'
  private given = new Set<number>()

  constructor(private scenario: Scenario) {}

  async update(input: BriefInput): Promise<BriefPatch> {
    const reached = input.segments.length
    const out: BriefPatch = { updates: [], typeProjet: '', typeProjetPreuve: null, resume: '', questionsSuggerees: [] }
    this.scenario.briefPatches.forEach((p, i) => {
      if (p.apresSegment > reached || this.given.has(i)) return
      this.given.add(i)
      out.updates.push(...p.patch.updates)
      if (p.patch.typeProjet) {
        out.typeProjet = p.patch.typeProjet
        out.typeProjetPreuve = p.patch.typeProjetPreuve
      }
      if (p.patch.resume) out.resume = p.patch.resume
      if (p.patch.questionsSuggerees.length) out.questionsSuggerees = p.patch.questionsSuggerees
    })
    await new Promise((r) => setTimeout(r, 300))
    return out
  }
}
