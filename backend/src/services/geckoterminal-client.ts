import { AppError, type ErrorCode } from '../errors/app-error.js'

interface Options {
  baseUrl: string
  timeoutMs: number
  intervalMs?: number
  fetcher?: typeof fetch
  clock?: () => number
}

/** One budget for candles, pool discovery, and trending within a backend process. */
export class GeckoTerminalClient {
  private readonly fetcher: typeof fetch
  private readonly clock: () => number
  private nextRequestAt = 0
  private cooldownUntil = 0
  private gate: Promise<void> = Promise.resolve()
  private readonly pending = new Map<string, Promise<unknown>>()
  private readonly cache = new Map<string, { data: unknown; expiresAt: number }>()

  constructor(private readonly options: Options) {
    this.fetcher = options.fetcher ?? fetch
    this.clock = options.clock ?? Date.now
  }

  async requestJson(path: string, code: ErrorCode): Promise<unknown> {
    const cached = this.cache.get(path)
    if (cached && cached.expiresAt > this.clock()) return cached.data
    const pending = this.pending.get(path)
    if (pending) return pending
    const request = this.load(path, code)
    this.pending.set(path, request)
    try { return await request } finally { this.pending.delete(path) }
  }

  private limited(code: ErrorCode, until: number) {
    const seconds = Math.max(1, Math.ceil((until - this.clock()) / 1000))
    return new AppError(code, 'Chart provider is temporarily limiting requests. Please wait for the cooldown.', 429, seconds)
  }

  private async load(path: string, code: ErrorCode) {
    const previous = this.gate
    let release!: () => void
    this.gate = new Promise<void>(resolve => { release = resolve })
    const queuedAt = this.clock()
    await previous
    try {
      if (this.cooldownUntil > this.clock()) throw this.limited(code, this.cooldownUntil)
      // Bound waits so a burst cannot keep serverless requests open indefinitely.
      if (this.clock() - queuedAt > 15_000) throw this.limited(code, this.clock() + 5_000)
      const waitMs = Math.max(0, this.nextRequestAt - this.clock())
      if (waitMs) await new Promise(resolve => setTimeout(resolve, waitMs))
      this.nextRequestAt = this.clock() + (this.options.intervalMs ?? 2200)
      let response: Response
      try {
        response = await this.fetcher(`${this.options.baseUrl.replace(/\/$/, '')}${path}`, {
          headers: { accept: 'application/json' }, signal: AbortSignal.timeout(this.options.timeoutMs),
        })
      } catch { throw new AppError(code, 'Market chart data is temporarily unavailable.', 503) }
      if (response.status === 429) {
        const header = response.headers.get('retry-after')
        const seconds = header === null ? NaN : Number(header)
        const duration = Number.isFinite(seconds) ? seconds * 1000 : header ? Date.parse(header) - this.clock() : 60_000
        this.cooldownUntil = this.clock() + Math.max(1000, Number.isFinite(duration) ? duration : 60_000)
        throw this.limited(code, this.cooldownUntil)
      }
      if (!response.ok) throw new AppError(code, 'Market chart data is temporarily unavailable.', 503)
      let data: unknown
      try { data = await response.json() } catch { throw new AppError(code, 'The chart provider returned invalid data.', 503) }
      // Do not refetch the same public endpoint during its one-minute cache window.
      if (this.cache.size >= 500) this.cache.delete(this.cache.keys().next().value!)
      this.cache.set(path, { data, expiresAt: this.clock() + 60_000 })
      return data
    } finally { release() }
  }
}
