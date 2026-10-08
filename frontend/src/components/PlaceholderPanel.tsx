import type { ReactNode } from 'react'

interface PlaceholderPanelProps { title: string; children: ReactNode }

export function PlaceholderPanel({ title, children }: PlaceholderPanelProps) {
  return (
    <section className="app-surface panel-cut border border-line bg-surface p-6 sm:p-8">
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      <div className="mt-3 max-w-2xl leading-7 text-muted">{children}</div>
    </section>
  )
}
