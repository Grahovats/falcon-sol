# Falcon

Falcon is a local-first competitive paper-trading platform for Solana markets. Operators authenticate with a Solana wallet, deploy into time-boxed missions with equal virtual capital, trade an approved market roster through simulated execution, and compete on a live Command Board. Wallet signatures establish identity only: Falcon never requests a transaction signature or moves real assets.

## Quick start

Requirements: Node.js 22+, npm 11+, and Docker with Docker Compose.

```bash
cd ~/falcon
npm install
npm run db:up
npm run setup
npm run dev
```

Open <http://127.0.0.1:5173>. The API is at <http://localhost:4000>, and its database-aware health check is <http://localhost:4000/health>.

`npm run setup` safely creates missing local `.env` files from the examples, installs dependencies, generates Prisma Client, applies migrations, and runs the idempotent seed. It does not overwrite existing environment files.

## Architecture

- `frontend/` — React 19, Vite, TypeScript, React Router, Tailwind CSS, Wallet Standard
- `backend/` — Fastify, TypeScript, Zod, Prisma, Ed25519 signature verification
- `backend/prisma/` — PostgreSQL schema, committed migrations, and competitor seed
- `scripts/setup-env.mjs` — non-destructive local environment setup
- `docker-compose.yml` — PostgreSQL 16 on port 5432 with a persistent volume

The backend is authoritative for authentication, execution, cash, positions, PnL, equity, and rank. Financial values use PostgreSQL `Decimal` fields and Prisma Decimal calculations. The frontend submits intent and renders server-calculated state.

## Authentication

Falcon uses a nonce-based wallet login:

1. The browser discovers installed Solana wallets through Wallet Standard.
2. The API issues a one-time, five-minute challenge bound to the wallet and approved frontend origin.
3. The wallet signs the exact challenge as an off-chain message.
4. The API verifies the Ed25519 signature, consumes the challenge, and creates an opaque session.
5. Only a SHA-256 hash of the session token is stored; the browser receives an `HttpOnly`, `SameSite=Lax` cookie.

Challenges cannot be replayed, expired challenges are rejected, auth endpoints are rate-limited, and changing the connected wallet clears a mismatched session. The Vite development proxy keeps cookies same-origin whether the UI is opened on `127.0.0.1` or `localhost`.

## Environment

`backend/.env`:

```dotenv
DATABASE_URL="postgresql://falcon:falcon@localhost:5432/falcon?schema=public"
PORT=4000
HOST=0.0.0.0
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
AUTH_DOMAIN=localhost:5173
AUTH_URI=http://localhost:5173
AUTH_CHALLENGE_TTL_SECONDS=300
AUTH_SESSION_TTL_DAYS=30
ADMIN_WALLET_ADDRESSES=
MISSION_LIFECYCLE_INTERVAL_MS=5000
NODE_ENV=development
MARKET_DATA_PROVIDER=mock
JUPITER_API_KEY=
JUPITER_API_BASE_URL=https://api.jup.ag
JUPITER_USDC_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
JUPITER_REQUEST_TIMEOUT_MS=5000
JUPITER_MAX_PRICE_IMPACT_PERCENT=5
GECKOTERMINAL_API_BASE_URL=https://api.geckoterminal.com/api/v2
GECKOTERMINAL_REQUEST_TIMEOUT_MS=8000
GECKOTERMINAL_CACHE_TTL_MS=60000
```

Set `ADMIN_WALLET_ADDRESSES` to a comma-separated list of public Solana wallet addresses. A wallet receives admin access only when it is both allowlisted and stored with the `ADMIN` database role; Falcon synchronizes that role during session verification. Never enter a private key or seed phrase. Restart the backend after changing the allowlist.

Set `MARKET_DATA_PROVIDER=jupiter` and provide a server-side `JUPITER_API_KEY` to enable Jupiter Price V3 and Swap V2 quote-only execution. Never expose that key through Vite or commit it.

Candlestick charts use GeckoTerminal's public Solana OHLC endpoint through the backend. No browser-side key is required; responses are cached to protect provider limits.

`frontend/.env`:

```dotenv
VITE_API_URL=/api/v1
```

The relative API URL is intentional: Vite proxies `/api` to port 4000 so the secure session remains first-party during local development.

## Development workflow

```bash
npm run dev             # backend and frontend together
npm run dev:backend     # API only
npm run dev:frontend    # Vite only
npm run db:up           # start PostgreSQL
npm run db:down         # stop PostgreSQL, retain its volume
npm run db:generate     # regenerate Prisma Client
npm run db:migrate      # apply/create development migrations
npm run db:seed         # refresh idempotent mission data
npm run check           # typecheck, lint, test, and build both apps
```

To destructively reset only the Falcon database and reseed it, run `npm run db:reset`.

## Seed data

The seed creates Operation Nightfall, five ranked demo competitors, and the BONK, WIF, POPCAT, PENGU, and FARTCOIN markets. Its mission window resets around the current time so the operation remains active. Real users are created only after a valid wallet signature.

Local development defaults to deterministic market data. Jupiter mode uses real prices and quote routes but remains paper trading: no swap is submitted.

## Product flows

- Wallet Standard discovery, explicit message signing, persistent server session, and sign-out
- Mission lobby separated into live, upcoming, and completed operations
- Authenticated deploy/join, portfolio, order history, and operator profile
- Server-authoritative BUY/SELL paper execution
- 100 vUSDC minimum BUY, 30% total exposure per market, long-only positions, no leverage or negative cash
- Deterministic local prices or Jupiter Price V3 valuation and Swap V2 quote-only fills
- Live portfolio, positions, allocation, quick sell, trade history, and equity-ranked Command Board
- Three-minute BLACKOUT that keeps trading open while concealing rankings
- Automatic registration → active → blackout → settling → finalized lifecycle
- Locked settlement prices, immutable final rankings, cancellation handling, and restart retries
- Wallet-allowlisted mission administration with atomic audit records

## API overview

Public routes under `/api/v1`:

- `POST /auth/challenge`
- `POST /auth/verify`
- `GET /auth/session`
- `POST /auth/logout`
- `GET /missions` and `GET /missions/:id`
- `GET /missions/:missionId/markets`
- `GET /missions/:missionId/leaderboard`

Session-protected routes:

- `POST /missions/:missionId/join`
- `GET /missions/:missionId/portfolio`
- `GET|POST /missions/:missionId/orders`
- `GET /profile`

Administration routes under `/api/v1/admin` require an authenticated `ADMIN` role and a wallet currently present in `ADMIN_WALLET_ADDRESSES`. Mission mutations and automatic lifecycle transitions are recorded in `AdminAuditLog`; `GET /admin/audit-logs` returns the latest 100 records.

`GET /health` is outside the version prefix. It returns HTTP 200 only when PostgreSQL is reachable; otherwise it returns HTTP 503.

## Database migrations

Committed migrations are applied in order:

- `20260929150000_init`
- `20260929170000_add_paper_trading_engine`
- `20260930103000_add_jupiter_execution_metadata`
- `20260930110159_add_wallet_auth`
- `20260930115046_add_admin_security_and_mission_settlement`

The schema includes role-bearing users, wallets, one-time auth challenges, hashed sessions, missions, markets, entries, orders, quote-audited fills, positions, locked mission results, and admin/system audit logs.

## Testing and verification

```bash
npm run check
```

The suite covers trading calculations and limits, mission states, deterministic pricing, Jupiter response handling, wallet authentication, dual admin authorization, safe status transitions, cancellation behavior, deterministic settlement, and locked-result calculations. For a local smoke test, verify <http://localhost:4000/health>, open the UI, connect an installed Solana wallet, and approve the sign-in message.

## Troubleshooting

- **Cannot reach the Falcon API**: run `npm run db:up`, then `npm run dev:backend`; check <http://localhost:4000/health>.
- **Health returns 503**: PostgreSQL is unavailable or `DATABASE_URL` is wrong. Inspect `docker compose ps` and `docker compose logs postgres`.
- **No wallet detected**: install a Wallet Standard-compatible Solana browser wallet, unlock it, and refresh.
- **Session does not persist**: use the relative `VITE_API_URL=/api/v1` and the Vite proxy; do not mix a direct cross-site API URL with localhost cookies.
- **CORS error**: `CORS_ORIGIN` must include the exact frontend origin.
- **Admin page is hidden or returns 403**: add only your public wallet address to `ADMIN_WALLET_ADDRESSES`, restart the backend, then sign out and back in.
- **Mission remains SETTLING**: mission control shows `lifecycleError`; the scheduler retries automatically after price or database recovery.
- **Missing-table error**: run `npm run db:migrate`.

## Remaining production work

Falcon is still paper trading. Before public deployment, add production hosting and managed PostgreSQL, Redis-backed rate limiting/session coordination for horizontal scaling, observability and alerting, browser end-to-end tests with wallet fixtures, and a formal security review. Entry fees, prizes, KYC, smart contracts, leverage, shorting, referrals, tokens, and NFTs are not implemented.
