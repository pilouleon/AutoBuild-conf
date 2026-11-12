// Compte rendu d'un rendez-vous : Markdown (CRM, fichier), texte d'e-mail (à coller) et HTML (PDF).

import { getProjectType } from '../catalog'
import type { TranscriptSegment } from '../types'
import { formatTime } from './prompt'
import { type Brief, type FieldDef, GROUPS, allFields, progress } from './schema'

export interface CompteRenduOptions {
  entreprise: string
  date?: Date
  titre?: string
  commercial?: string
  interlocuteurs?: string[]
  dureeMin?: number
  transcript?: TranscriptSegment[]
}

function dateLongue(d: Date): string {
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function valeurDe(brief: Brief, f: FieldDef): string | undefined {
  const c = brief.champs[f.id]
  if (!c || c.status === 'manquant') return undefined
  return c.valeur ?? c.items?.map((i) => i.nom).join(', ')
}

export function briefToMarkdown(brief: Brief, opts: CompteRenduOptions): string {
  const d = opts.date ?? new Date()
  const pt = getProjectType(brief.typeProjet)
  const p = progress(brief)
  const fields = allFields(brief)
  const lines: string[] = [
    `# ${opts.titre ?? 'Compte rendu'} — ${opts.entreprise}`,
    '',
    `${cap(dateLongue(d))}${opts.dureeMin ? ` · ${opts.dureeMin} min` : ''}${opts.commercial ? ` · ${opts.commercial}` : ''}${opts.interlocuteurs?.length ? ` · avec ${opts.interlocuteurs.join(', ')}` : ''}`,
    '',
    `**Type de projet :** ${pt?.label ?? 'à préciser'} · **Brief rempli à ${p.pct} %**`,
    '',
    brief.resume ? `> ${brief.resume}` : '',
    ''
  ]
  for (const g of GROUPS) {
    const gf = fields.filter((x) => x.groupe === g.id)
    if (!gf.length) continue
    lines.push(`## ${g.label}`, '')
    for (const f of gf) {
      const c = brief.champs[f.id]
      if (!c || c.status === 'manquant') {
        lines.push(`- **${f.label}** : _à obtenir_`)
        continue
      }
      lines.push(`- **${f.label}**${c.status === 'partiel' ? ' (partiel)' : ''} : ${c.valeur ?? ''}`)
      for (const i of c.items ?? []) lines.push(`  - ${i.nom}${i.details ? ` — ${i.details}` : ''}${i.attributs?.length ? ` (${i.attributs.join(', ')})` : ''}`)
      const pr = c.preuves[0]
      if (pr) lines.push(`  - _Source : ${pr.source === 'transcript' ? `« ${pr.citation} » (${pr.segmentId})` : pr.source === 'site' ? 'site web' : 'saisie du commercial'}_`)
    }
    lines.push('')
  }
  const manquants = fields.filter((f) => !valeurDe(brief, f))
  if (manquants.length) lines.push('## À obtenir au prochain échange', '', ...manquants.map((f) => `- ${f.label}`), '')
  if (opts.transcript?.length) {
    lines.push('## Transcription', '')
    for (const s of opts.transcript) lines.push(`**${formatTime(s.startMs)} ${s.speaker === 'commercial' ? 'Commercial' : 'Prospect'}** — ${s.text}`, '')
  }
  return lines.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n')
}

/** Texte d'e-mail de suivi à envoyer au prospect (à relire avant envoi). */
export function compteRenduEmail(brief: Brief, opts: CompteRenduOptions): string {
  const fields = allFields(brief)
  const get = (id: string) => {
    const f = fields.find((x) => x.id === id)
    return f ? valeurDe(brief, f) : undefined
  }
  const besoins = ['objectifs', 'modules', 'ecrans_prioritaires', 'roles', 'integrations'].map((id) => [fields.find((f) => f.id === id)?.label, get(id)] as const).filter(([, v]) => v)
  const prenom = opts.interlocuteurs?.[0]?.split(' ')[0]
  const out = [
    `Objet : ${opts.entreprise} — suite à notre échange du ${(opts.date ?? new Date()).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`,
    '',
    `Bonjour${prenom ? ` ${prenom}` : ''},`,
    '',
    'Merci pour le temps que vous nous avez accordé. Voici ce que nous avons retenu de notre échange :',
    '',
    brief.resume ? `${brief.resume}\n` : '',
    ...besoins.map(([l, v]) => `• ${l} : ${v}`),
    ''
  ]
  const suite = get('prochaine_etape')
  out.push(suite ? `Prochaine étape convenue : ${suite}.` : 'Nous revenons vers vous très prochainement avec une proposition.', '')
  out.push('Vous trouverez ci-joint quelques écrans de la maquette présentée en fin de rendez-vous (données fictives).', '', 'Bien cordialement,', opts.commercial ?? '')
  return out.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n').trim()
}

/** HTML imprimable (export PDF) à partir du Markdown. */
export function compteRenduHtml(markdown: string, opts: { couleur?: string; logoDataUrl?: string; agence?: string }): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const inline = (s: string) =>
    esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/_(.+?)_/g, '<em>$1</em>')
  const html: string[] = []
  let list = 0
  const closeLists = (to: number) => {
    while (list > to) {
      html.push('</ul>')
      list--
    }
  }
  for (const raw of markdown.split('\n')) {
    const m = raw.match(/^(\s*)- (.*)$/)
    if (m) {
      const depth = Math.floor(m[1].length / 2) + 1
      while (list < depth) {
        html.push('<ul>')
        list++
      }
      closeLists(depth)
      html.push(`<li>${inline(m[2])}</li>`)
      continue
    }
    closeLists(0)
    if (raw.startsWith('# ')) html.push(`<h1>${inline(raw.slice(2))}</h1>`)
    else if (raw.startsWith('## ')) html.push(`<h2>${inline(raw.slice(3))}</h2>`)
    else if (raw.startsWith('> ')) html.push(`<blockquote>${inline(raw.slice(2))}</blockquote>`)
    else if (raw.trim()) html.push(`<p>${inline(raw)}</p>`)
  }
  closeLists(0)
  const c = opts.couleur ?? '#1f2937'
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
  body{font:11pt/1.5 -apple-system,"Segoe UI",Inter,Roboto,sans-serif;color:#1f2937;margin:0;padding:28px 36px}
  header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid ${c};padding-bottom:12px;margin-bottom:18px}
  header img{max-height:42px;max-width:180px}
  h1{font-size:20pt;margin:0 0 4px;color:#111827}
  h2{font-size:12.5pt;margin:22px 0 6px;color:${c};border-bottom:1px solid #e5e7eb;padding-bottom:4px}
  blockquote{margin:10px 0;padding:10px 14px;background:#f8fafc;border-left:3px solid ${c}}
  ul{margin:4px 0 4px 18px;padding:0} li{margin:2px 0} em{color:#6b7280}
  footer{margin-top:28px;font-size:8.5pt;color:#9ca3af}
</style></head><body><header><span style="font-size:9pt;color:#6b7280">${esc(opts.agence ?? '')}</span>${opts.logoDataUrl ? `<img src="${opts.logoDataUrl}">` : ''}</header>${html.join('\n')}<footer>Compte rendu généré par AutoBuild — à relire avant diffusion.</footer></body></html>`
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
