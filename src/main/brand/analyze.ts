// Analyse du texte du site du prospect par un LLM : ton, secteur, slogan, vocabulaire.

import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { GoogleGenAI } from '@google/genai'
import { z } from 'zod'
import { type ClaudeCli, claudeStructured } from '../claude-code/cli'
import type { SiteAnalysis } from './extract'

const AnalysisSchema = z.object({
  secteur: z.string().describe("Secteur d'activité en quelques mots"),
  description: z.string().describe("Ce que fait l'entreprise, en une phrase"),
  ton: z.string().describe('Ton de communication en 3 à 6 mots (ex. "institutionnel, rassurant, technique")'),
  slogan: z.string().describe("Accroche principale du site, recopiée telle quelle, ou chaîne vide"),
  vocabulaire: z.array(z.string()).describe('Jusqu’à 25 noms propres, produits, services ou termes métier du site')
})

const prompt = (siteText: string, nom: string) =>
  `Voici le texte de la page d'accueil du site de l'entreprise « ${nom} ». Décris son activité et son style de communication, uniquement à partir de ce texte.\n\n${siteText}`

export function claudeSiteAnalyzer(apiKey: string, model: string) {
  const client = new Anthropic({ apiKey })
  return async (siteText: string, nom: string): Promise<SiteAnalysis> => {
    const res = await client.beta.messages.parse({
      model,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: betaZodOutputFormat(AnalysisSchema) },
      messages: [{ role: 'user', content: prompt(siteText, nom) }]
    })
    if (res.stop_reason === 'refusal' || !res.parsed_output) throw new Error('analyse indisponible')
    return res.parsed_output
  }
}

export function geminiSiteAnalyzer(apiKey: string, model: string) {
  const ai = new GoogleGenAI({ apiKey })
  const schema = z.toJSONSchema(AnalysisSchema)
  return async (siteText: string, nom: string): Promise<SiteAnalysis> => {
    const res = await ai.models.generateContent({
      model,
      contents: prompt(siteText, nom),
      config: { responseMimeType: 'application/json', responseJsonSchema: schema, temperature: 0.2 }
    })
    return AnalysisSchema.parse(JSON.parse(res.text ?? '{}'))
  }
}

export function claudeCodeSiteAnalyzer(cli: ClaudeCli, model: string, cwd: string) {
  const schema = z.toJSONSchema(AnalysisSchema) as Record<string, unknown>
  return async (siteText: string, nom: string): Promise<SiteAnalysis> => {
    const { data } = await claudeStructured<unknown>({
      cli,
      model,
      effort: 'low',
      system: 'Tu analyses le site web d’une entreprise pour préparer un rendez-vous commercial. Réponds uniquement avec l’objet JSON demandé.',
      prompt: prompt(siteText, nom),
      schema,
      cwd,
      timeoutMs: 90_000
    })
    return AnalysisSchema.parse(data)
  }
}
