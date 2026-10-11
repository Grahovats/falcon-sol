# Falcon research — 11 October 2026

Research based on the [shared Falcon brief](https://docs.google.com/document/d/1WyWoJZXK8ch7LvFRDrxIwfUyb2z--R0Rpih_k_yD8AA/edit). This is a focused review of competitors, execution integrity, contest economics, legal questions, and a practical validation plan. It is not an exhaustive market census or a legal opinion. Provider documentation and competitors' public statements establish advertised capabilities, not independently audited performance or demand.

**Recommendation:** proceed with a small, free competition pilot. Delay participant-funded prize pools until both repeat participation and the intended legal structure are established. The brief gives a useful product direction, but equal capital, a tactical brand, and quotes alone do not establish differentiation, skill, or execution fairness.

**1. Competitors and differentiation**

| Product | Evidence found | Implication for Falcon |
|---|---|---|
| PaperLeague | Public rules describe fixed starting SOL balances, fixed trade sizes, live competitions, server-confirmed market-cap pricing, rankings, and prizes. Late participation is allowed. | Equal capital and competitive paper trading already exist. Same-start registration, flexible position sizing, a restricted market universe, and clearer scoring are potential distinctions to test. |
| PaperLeague Bot Arena | The site advertises hosted bots and participation in competitions; several ownership and marketplace capabilities are described as planned. | A bot arena is adjacent competition rather than an uncontested expansion opportunity. |
| League of Memes | A public Telegram channel advertises price-based team pots, a 5v5 draft system, and an upcoming test phase. | Treat this as evidence of an announced adjacent concept. I did not verify a working arena, settled prizes, or meaningful player activity. |

Sources: [PaperLeague rules](https://paperleague.fun/), [Bot Arena](https://paperleague.fun/arena), [League of Memes channel](https://t.me/s/leagueofmemes).

PaperLeague's page contains conflicting statements about closing positions and whether on-chain logging is already operating or planned. Avoid presenting its trust claims as verified. Public pages also do not establish either competitor's revenue or retention. [PaperLeague](https://paperleague.fun/)

My inference: Falcon can distinguish itself through a credible, easy-to-understand competition with consistent rules and a community that returns. “Competitive trading as a sport” is useful positioning, but it is not a demonstrated moat. Test whether players prefer Falcon's actual rules over alternatives.

**2. What Jupiter solves, and what it does not**

Jupiter's current documentation supports quote-only requests to `/swap/v2/order` without a `taker`; `outAmount` is expected output before slippage. It explicitly states that quotes do not guarantee execution. Fees and routing must also be understood. The older Metis API documentation says that API has been superseded by Swap V2. [Order & Execute](https://developers.jup.ag/docs/swap/order-and-execute), [legacy API notice](https://developers.jup.ag/docs/api-reference/swap/v1/swap)

The `/build` path provides a quote and swap instructions using Metis routing. It has different routing and platform-fee behavior from `/order`. These are integration choices, not interchangeable sources of identical prices. [Build documentation](https://developers.jup.ag/docs/swap/build)

Engineering inference: amount-specific quotes are substantially better than dividing notional by a displayed price, but describe the result as **quote-based simulated execution**. Falcon never changes real reserves. Repeated synthetic orders can therefore reuse market depth that actual orders would consume. A quote also does not reproduce transaction landing, failed execution, or the participant's actual ability to fund a swap.

Before prize-bearing competition, define and publish:

- Quote age limits, a consistent request/acceptance timestamp rule, and handling of provider outages.
- Exactly which fees are represented in net received quantities. Do not subtract a quoted fee twice.
- Maximum position size and trade frequency; check rapid split orders and repeated round trips for simulation advantages.
- Approved mint addresses, buy and sell depth at permitted sizes, and halt rules. TVL alone is not executable depth.
- Whether closing scores represent a common spot snapshot or simulated liquidation proceeds. Either can be a game rule, but they make different promises.
- A deadline valuation policy that cannot drift to a later price merely because a settlement job retries.

The document's suggested liquidity-to-prize relationship is a useful concern, not a validated formula. Stress-test the real cost of moving a reference price against the maximum obtainable reward. Distributing exposure across accounts must be included in that model.

**3. Relevant findings in the existing Falcon code**

This was a targeted source inspection, not a full audit or a live integration test.

| Finding | Evidence | Action |
|---|---|---|
| Trades already use amount-specific buy/sell quotes. | `backend/src/services/jupiter-market-data-service.ts`, `getExecutionQuote` calls `/swap/v2/order`; `trading-service.ts` records quoted quantities. | Retain this foundation; test against actual provider responses and documented fee semantics. |
| Quote metadata and freshness checks exist. | `trading-service.ts`, `quoteMetadata` and `assertQuoteUsable`; the latter rejects quotes older than ten seconds. | Decide whether ten seconds is acceptable for this game's markets; record the acceptance policy in the rules. |
| Final open positions use spot valuation. | `mission-lifecycle-service.ts`, `settle` fetches `getPrices`; `buildSettlementResults` multiplies quantity by price. | If promising executable final equity, use an amount-aware liquidation model. Otherwise explicitly publish spot marking and restrict thin assets. |
| Settlement fetches prices when its job runs. | `mission-lifecycle-service.ts`, `settle`. | Establish a durable cutoff snapshot or other predetermined valuation window, including retries. |
| Global rankings prioritize average return. | `ranking-service.ts`, `buildGlobalRankings`. | Avoid presenting this as a validated skill rating. A provisional ranking and minimum sample requirement would better reflect uncertainty. |

Do not rewrite the existing React/Vite frontend into Next.js merely because the brief lists Next.js. No reviewed evidence establishes that a framework migration is necessary.

**4. Qualification, payouts, and unit economics**

The brief has one arithmetic inconsistency: 100 entrants paying $10 with a 10% fee leave a $900 prize pool. If 60 qualify, equal division is **$15 each**, not $16.67. The latter assumes the entire $1,000 is distributed. At 20 qualifiers, equal division is $45 each.

These are calculations, not evidence of willingness to pay. A 10% fee yields $100 for that event before expenses. Small events may be unprofitable after acquisition, support, infrastructure, payment operations, and abuse losses.

Likewise, 10 events/day × 500 entries × $10 × 8% yields $4,000/day; $120,000 assumes 30 days. That requires 5,000 paid entries every day. Entries are not unique users, and the brief provides no evidence that Falcon can reach that volume.

For the first pilot, separate **placement**, **qualification**, and **reward eligibility**. My recommendation is placement by published final equity, with a fixed sponsor reward schedule for specified places. If a positive-return qualification threshold is used, define what happens when nobody clears it. Define ties, minimum participation, disqualification, cancellation, and unallocated rewards before registration opens.

Top 20% plus positive return limits the number of qualifiers, but it does not demonstrate that winners were selected predominantly by skill. It can also produce no qualifiers in a falling market. A benchmark-relative target introduces additional choices about constituents, weights, timestamps, halts, and missing prices. Test it later rather than making it an unexplained moving target.

**5. Serbia and international legal questions**

The Serbian regulator publishes a consolidated Games of Chance Act incorporating amendments 18/2020 and 94/2024. Article 2 has a specific skill-competition exclusion involving public competition, pre-qualified participants, direct participation, and an organizer-appointed commission. Article 3's entertainment-game exclusion does not provide a general cash-prize simulator exemption. Article 4 assigns classification to the Ministry. These provisions do not establish Falcon's eligibility. [Official law, Articles 2–4](https://www.uis.gov.rs/static/uploads/2753_Law_on_games_of_chance.pdf)

The National Bank of Serbia separately describes licensing of services related to virtual currencies. Whether Falcon's particular entry collection, vault, and payout arrangement constitutes a regulated service needs analysis of the exact arrangement. Receiving crypto is not, by itself, proof that every such license applies. [NBS digital-assets guidance](https://nbs.rs/sr/ciljevi-i-funkcije/nadzor-nad-finansijskim-institucijama/digital-imo/index.html)

The SEC's **2015** investor alert expressly discusses paid-entry virtual stock portfolios with prizes and potential securities-based swaps. It concerns referenced securities and is not a ruling that every crypto trading contest is a swap. Crypto denomination does not itself resolve the issue. [SEC investor alert](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-alerts/investor-58)

Recommendation: obtain written advice on the Serbian operator, intended participant countries, specific referenced assets, entry consideration, prize funding, custody/control, tax, advertising, and age/identity requirements. Request separate treatment of free play, sponsor rewards, and entry-funded rewards. Free entry removes the participant stake but does not automatically resolve all prize, payment, or promotional obligations. No paid launch clearance follows from this research.

**6. Player demand is still unproven**

No source reviewed establishes that Falcon's players will return or pay. The “fun,” healthy engagement, sponsor demand, and six-week delivery assertions in the brief are hypotheses. Copy that urges players to chase losses should not be treated as a product success criterion.

My proposed validation experiment:

1. Interview 10–15 relevant traders about their most recent trading experience, competitions tried, and reasons to participate. Ask about actual behavior before pitching prizes.
2. Recruit a small cohort for three scheduled 30-minute free missions across two weeks. Concentrate attendance rather than opening constant events. The initial size is an experiment choice, not a market benchmark.
3. Use the same approved market list, capital, exposure limits, and published scoring rules across comparable rounds. Keep entry, prize, and cancellation terms clear.
4. Measure registration → attendance → first trade → completion → return to the next eligible mission. Record whether a returner needed a fresh incentive.
5. Interview returners and non-returners. Classify execution disputes, confusing rules, scheduling friction, and prize-only motivation separately.
6. Set continuation criteria before the pilot. An example internal target is at least 30% of first-event active players attending another offered event, with enough participants to make the estimate useful. This is a proposed target, not an industry statistic or product-market-fit threshold.

Use a rules-based random-strategy baseline and a simple buy-and-hold basket as comparisons, without placing bots in human prize standings. Multiple rounds can reveal whether outcomes are consistently better than simple baselines; a single short tournament cannot establish trading skill.

**7. Infrastructure assumptions and next work**

Jupiter currently advertises 1 request/second on Free, 10 on the $25/month Developer plan, and 50 on the $100/month Launch plan; paid tiers include credits and usage overage. These are current advertised limits, not a guarantee of total application cost. [Jupiter pricing](https://developers.jup.ag/pricing)

As a capacity example, 100 players each requesting one quote every ten seconds generate 10 quote requests/second before price updates and retries. Average capacity also conceals simultaneous deadline bursts. Batch common price reads, apply per-player order limits, and budget for quote bursts before announcing a 100-player event.

The next useful work is to publish precise scoring/settlement rules, test quote and fee handling, make deadline valuation reproducible, run a small pilot, and commission the legal analysis of any prize/payment format being considered. Add contracts, a complex rating, and additional formats only after those experiments justify them.

Unresolved: paid-contest classification in the intended countries; actual quote performance under load; willingness to pay; retention without escalating rewards; competitor traction; manipulation cost at specific market depths; and sponsor demand. None is established by the brief or this desk research.
