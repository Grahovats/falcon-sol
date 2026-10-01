interface PageHeaderProps { eyebrow: string; title: string; description: string }

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <header className="max-w-3xl">
      <p className="mb-3 font-mono text-xs uppercase tracking-[0.22em] text-primary">{eyebrow}</p>
      <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{title}</h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted">{description}</p>
    </header>
  )
}
