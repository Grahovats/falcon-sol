interface PageHeaderProps { title: string; description?: string; eyebrow?: string }

export function PageHeader({ title, description, eyebrow = 'Falcon' }: PageHeaderProps) {
  return <header className="app-page-heading pb-6 sm:pb-8">
    <p className="mb-4 text-xs font-medium uppercase tracking-widest text-muted">{eyebrow}</p>
    <div className="max-w-3xl">
      <h1 className="text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">{title}<span className="text-primary" aria-hidden="true">.</span></h1>
      {description && <p className="mt-4 max-w-2xl text-base leading-7 text-muted">{description}</p>}
    </div>
  </header>
}
