import { createServer } from 'node:http'
import { once } from 'node:events'
import Fastify from 'fastify'
import { expect, it, vi } from 'vitest'

const { buildApp } = vi.hoisted(() => ({ buildApp: vi.fn() }))
vi.mock('./app.js', () => ({ buildApp }))

import handler from './vercel.js'

it('handles concurrent and warm HTTP requests without opening a Fastify listener', async () => {
  const app = Fastify()
  const listen = vi.spyOn(app, 'listen')
  app.get('/api/health', async () => ({ status: 'ok' }))
  app.post('/api/v1/echo', async (request, reply) => {
    reply.header('set-cookie', 'session=test; HttpOnly; SameSite=Lax')
    return { body: request.body, cookie: request.headers.cookie }
  })
  buildApp.mockResolvedValue(app)
  expect(buildApp).not.toHaveBeenCalled()

  const server = createServer((request, response) => {
    void handler(request, response).catch(() => {
      response.statusCode = 500
      response.end()
    })
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('No HTTP server address')
  const url = `http://127.0.0.1:${address.port}`

  try {
    const responses = await Promise.all([
      fetch(`${url}/api/health`),
      fetch(`${url}/api/v1/echo`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: 'session=existing' },
        body: JSON.stringify({ walletAddress: 'test-wallet' }),
      }),
    ])
    expect(responses.map((response) => response.status)).toEqual([200, 200])
    expect(await responses[0]!.json()).toEqual({ status: 'ok' })
    expect(await responses[1]!.json()).toEqual({ body: { walletAddress: 'test-wallet' }, cookie: 'session=existing' })
    expect(responses[1]!.headers.get('set-cookie')).toContain('HttpOnly')
    const missing = await fetch(`${url}/api/missing`)
    expect(missing.status).toBe(404)
    await missing.text()
    expect(buildApp).toHaveBeenCalledOnce()
    expect(listen).not.toHaveBeenCalled()
  } finally {
    const closed = once(server, 'close')
    server.close()
    server.closeAllConnections()
    await closed
    await app.close()
  }
})
