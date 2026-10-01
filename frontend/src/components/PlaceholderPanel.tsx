import type { ReactNode } from 'react'

interface PlaceholderPanelProps { label: string; title: string; children: ReactNode }

export function PlaceholderPanel({ label, title, children }: PlaceholderPanelProps) {
  return (
    <section className="panel-cut border border-line bg-surface p-6 sm:p-8">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">{label}</p>
      <h2 className="mt-3 text-xl font-semibold text-ink">{title}</h2>
      <div className="mt-3 max-w-2xl leading-7 text-muted">{children}</div>
    </section>
  )
}
