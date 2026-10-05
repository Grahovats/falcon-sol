interface PageHeaderProps { title: string }

export function PageHeader({ title }: PageHeaderProps) {
  return (
    <header className="border-b border-line pb-5">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-[-0.03em] text-ink sm:text-4xl">{title}</h1>
      </div>
    </header>
  )
}
