const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '/api/v1').replace(/\/$/, '')

interface ApiErrorBody { error?: { code?: string; message?: string } | string }

export class ApiError extends Error {
  readonly status: number
  readonly code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export function apiGet<T>(path: string, signal?: AbortSignal) {
  return request<T>('GET', path, undefined, signal)
}

export function apiPost<T>(path: string, body?: unknown) {
  return request<T>('POST', path, body)
}

export function apiPatch<T>(path: string, body: unknown) {
  return request<T>('PATCH', path, body)
}

async function request<T>(method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const options: RequestInit = {
    method,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    credentials: 'include',
  }
  if (body !== undefined) options.body = JSON.stringify(body)
  if (signal !== undefined) options.signal = signal

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, options)
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(`Cannot reach the Falcon API at ${API_BASE_URL}. Start PostgreSQL and the backend, then retry.`, 0, 'NETWORK_ERROR')
  }

  if (!response.ok) {
    const bodyValue: unknown = await response.json().catch(() => null)
    const error = isApiErrorBody(bodyValue) ? bodyValue.error : undefined
    const message = typeof error === 'string' ? error : error?.message ?? 'The Falcon API request failed.'
    const code = typeof error === 'object' ? error.code : undefined
    throw new ApiError(message, response.status, code)
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return typeof value === 'object' && value !== null && 'error' in value
}
