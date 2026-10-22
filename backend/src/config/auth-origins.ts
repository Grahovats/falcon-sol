import { AppError } from '../errors/app-error.js'

export function trustedAuthOrigins(authUri: string, corsOrigin: string, deploymentHosts: (string | undefined)[] = []) {
  return [...new Set([
    new URL(authUri).origin,
    ...corsOrigin.split(',').map(value => value.trim()).filter(Boolean).map(value => new URL(value).origin),
    ...deploymentHosts.filter((host): host is string => Boolean(host)).map(host => new URL(`https://${host}`).origin),
  ])]
}

export function resolveAuthOrigin(requestOrigin: string | undefined, allowedOrigins: string[], fallback: string) {
  if (!requestOrigin) return new URL(fallback).origin
  if (allowedOrigins.includes(requestOrigin)) return requestOrigin
  // Never hand a wallet a challenge for a different site.
  throw new AppError('AUTH_ORIGIN_NOT_ALLOWED', 'Sign-in is not configured for this website address. Open the main Falcon site or ask the operator to enable this domain.', 403)
}
