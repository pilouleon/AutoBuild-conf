// Graphiques SVG légers (barres, courbe, donut) aux couleurs de la marque.
import { formatValue } from '../lib/format'

type Datum = { label: string; valeur: number }

const PALETTE = ['var(--brand-primary)', 'var(--brand-secondary)', 'var(--brand-accent)', '#94a3b8', '#cbd5e1', '#64748b']

export function BarChart({ data, format }: { data: Datum[]; format?: string }) {
  const max = Math.max(1, ...data.map((d) => d.valeur))
  return (
    <div className="flex h-48 items-end gap-3 px-1">
      {data.map((d) => (
        <div key={d.label} className="group flex flex-1 flex-col items-center gap-2">
          <span className="text-[11px] font-medium text-slate-500 opacity-0 transition group-hover:opacity-100">{formatValue(d.valeur, format)}</span>
          <div className="w-full rounded-t-md bg-primary/85 transition group-hover:bg-primary" style={{ height: `${Math.max(4, (d.valeur / max) * 140)}px` }} />
          <span className="text-[11px] text-slate-500">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

export function LineChart({ data, format }: { data: Datum[]; format?: string }) {
  const w = 480
  const h = 170
  const max = Math.max(1, ...data.map((d) => d.valeur))
  const min = Math.min(0, ...data.map((d) => d.valeur))
  const x = (i: number) => (data.length <= 1 ? w / 2 : (i / (data.length - 1)) * (w - 20) + 10)
  const y = (v: number) => h - 20 - ((v - min) / (max - min || 1)) * (h - 40)
  const points = data.map((d, i) => `${x(i)},${y(d.valeur)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-48 w-full">
      <polyline points={`10,${h - 20} ${points} ${x(data.length - 1)},${h - 20}`} fill="var(--brand-primary)" opacity={0.08} />
      <polyline points={points} fill="none" stroke="var(--brand-primary)" strokeWidth={2.5} strokeLinejoin="round" />
      {data.map((d, i) => (
        <g key={d.label}>
          <circle cx={x(i)} cy={y(d.valeur)} r={3.5} fill="white" stroke="var(--brand-primary)" strokeWidth={2} />
          <text x={x(i)} y={h - 4} textAnchor="middle" className="fill-slate-500 text-[11px]">{d.label}</text>
          <title>{formatValue(d.valeur, format)}</title>
        </g>
      ))}
    </svg>
  )
}

export function DonutChart({ data, format }: { data: Datum[]; format?: string }) {
  const total = data.reduce((s, d) => s + d.valeur, 0) || 1
  let acc = 0
  const r = 52
  const c = 2 * Math.PI * r
  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 140 140" className="h-40 w-40 shrink-0 -rotate-90">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#f1f5f9" strokeWidth={18} />
        {data.map((d, i) => {
          const len = (d.valeur / total) * c
          const el = <circle key={d.label} cx="70" cy="70" r={r} fill="none" stroke={PALETTE[i % PALETTE.length]} strokeWidth={18} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-acc} />
          acc += len
          return el
        })}
      </svg>
      <ul className="space-y-2 text-sm">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="text-slate-600">{d.label}</span>
            <span className="font-medium text-slate-900">{formatValue(d.valeur, format)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
