import { describe, expect, it } from 'vitest'
import { resolveAuthOrigin, trustedAuthOrigins } from './auth-origins.js'

describe('sign-in origins', () => {
  const main = 'https://falconsol.vercel.app'
  const preview = 'https://falcon-preview-team.vercel.app'
  const origins = trustedAuthOrigins(main, 'http://localhost:5173, https://falcon.example', [new URL(preview).host, undefined])

  it('uses the exact trusted browser origin for production, custom domains, previews and local ports', () => {
    for (const origin of [main, preview, 'https://falcon.example', 'http://localhost:5173']) {
      expect(resolveAuthOrigin(origin, origins, main)).toBe(origin)
    }
  })

  it('rejects untrusted origins instead of producing a mismatched challenge', () => {
    for (const origin of ['https://evil.vercel.app', `${main}.evil.example`, 'http://localhost:5174', 'null']) {
      expect(() => resolveAuthOrigin(origin, origins, main)).toThrow('Sign-in is not configured')
    }
  })

  it('uses the configured origin only when the request has no Origin header', () => {
    expect(resolveAuthOrigin(undefined, origins, `${main}/`)).toBe(main)
  })
})
