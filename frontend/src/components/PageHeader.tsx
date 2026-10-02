interface PageHeaderProps { title: string; description: string }

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <header className="border-b border-line pb-7">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-[-0.03em] text-ink sm:text-4xl">{title}</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted">{description}</p>
      </div>
    </header>
  )
}
