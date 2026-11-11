// Export du brief en Markdown (compte rendu à envoyer ou à coller dans le CRM).

import { getProjectType } from '../catalog'
import type { TranscriptSegment } from '../types'
import { formatTime } from './prompt'
import { type Brief, FIELDS, GROUPS, progress } from './schema'

export function briefToMarkdown(brief: Brief, opts: { entreprise: string; date?: Date; transcript?: TranscriptSegment[] }): string {
  const d = opts.date ?? new Date()
  const pt = getProjectType(brief.typeProjet)
  const lines: string[] = [
    `# Brief — ${opts.entreprise}`,
    '',
    `Rendez-vous du ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} · Brief rempli à ${progress(brief).pct} %`,
    '',
    `**Type de projet :** ${pt?.label ?? 'à préciser'}`,
    '',
    brief.resume ? `> ${brief.resume}` : '',
    ''
  ]
  for (const g of GROUPS) {
    lines.push(`## ${g.label}`, '')
    for (const f of FIELDS.filter((x) => x.groupe === g.id)) {
      const c = brief.champs[f.id]
      if (!c || c.status === 'manquant') {
        lines.push(`- **${f.label}** : _manquant_ — question à poser : « ${f.question} »`)
        continue
      }
      lines.push(`- **${f.label}**${c.status === 'partiel' ? ' (partiel)' : ''} : ${c.valeur ?? ''}`)
      for (const i of c.items ?? []) lines.push(`  - ${i.nom}${i.details ? ` — ${i.details}` : ''}${i.attributs?.length ? ` (${i.attributs.join(', ')})` : ''}`)
      const p = c.preuves[0]
      if (p) lines.push(`  - _Source : ${p.source === 'transcript' ? `« ${p.citation} » (${p.segmentId})` : p.source === 'site' ? `site web` : 'saisie du commercial'}_`)
    }
    lines.push('')
  }
  if (opts.transcript?.length) {
    lines.push('## Transcription', '')
    for (const s of opts.transcript) lines.push(`**${formatTime(s.startMs)} ${s.speaker === 'commercial' ? 'Commercial' : 'Prospect'}** — ${s.text}`, '')
  }
  return lines.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n')
}
