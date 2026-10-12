# Running Falcon prize missions

The implemented launch model is free, sponsor-funded paper trading. Paid entry is disabled in both registration and the UI, including plans marked HYBRID. Entry collection, payment custody, fees and player refunds need a separate reviewed integration before paid missions can launch. There is no spectator betting.

## First event

1. In Mission control, create a future draft with 10,000 virtual USDC, a fixed roster, and a 72-hour trading window. Seven days of lead time is the default. Practice missions, including the local 14-day Test Flight, remain separate.
2. Configure all enabled markets before adding a prize plan. Adding a plan freezes schedule, capital and roster. Use only countries reviewed by the legal organizer. Review and edit the published rules before accepting the organizer declaration.
3. Use a dedicated Solana mainnet treasury wallet per mission. Sponsor prize deposits must be separate from any operating budget. The application never requests private keys or signs transfers. This wallet is organizer-controlled, not contract escrow.
4. Publish the draft by changing its status to REGISTRATION. Funding closes at least 48 hours before trading starts. Verify each sponsor deposit using its original sender, exact genuine USDC amount and finalized transaction signature. Only deposits received after plan creation and before the funding deadline qualify. Treasury balance must cover recorded deposits. Unfunded missions cannot accept entrants.
5. Entrants accept the rules, confirm adulthood and choose an eligible residence country. A pending registration cannot trade. An administrator verifies identity, age and residence externally, then records a stable provider person reference, verified country and an evidence note. Never enter raw identity documents. The app hashes the provider reference using IDENTITY_HASH_SECRET and rejects a person associated with a different account. Provider references must be consistent; this does not replace real identity verification.
6. Complete all eligibility approvals before registration closes. The lifecycle worker locks the prize amount after checking minimum approved entrants, treasury coverage and executable quotes on the roster. Cash missions require Jupiter pricing; mock pricing is refused. If the worker misses funding or start requirements, the cash mission cancels rather than extending the schedule.
7. Keep the lifecycle worker running through the deadline. Its settlement uses full-position sell quotes captured in the first 60 seconds after the deadline, not historical deadline prices. An incomplete settlement after that window cancels the cash event and requires sponsor returns. All trading stops at the deadline.
8. Review final trading results for 48 hours. At least one filled buy of 100 virtual USDC qualifies a trader for awards. Exclude confirmed ineligible entrants with recorded evidence. Prepare awards only after review. Insufficient qualifying finishers require cancellation and sponsor returns. Exact equity ties share the budgets of their occupied prize positions; all USDC micro-units are conserved deterministically.
9. A different authenticated administrator approves the awards. Send exact USDC amounts from the mission treasury to the published winner wallets using your own wallet tooling. Record each finalized receipt. Payment targets 72 hours after approval. The application does not automatically pay or guarantee the deadline.
10. On cancellation, send each recorded sponsor deposit back to its original sender and verify its return receipt. A cancellation record alone does not return funds. Receipts are publicly linked on the mission page.

## Configuration and limits

Run `npm --prefix backend run db:generate` and `cd backend && npx prisma migrate deploy` in deployment. Configure a reliable `SOLANA_RPC_URL` for mainnet, Jupiter credentials, two separate admin accounts, and a stable random `IDENTITY_HASH_SECRET` of at least 32 characters. A local secret was generated for development; deployment secrets must be provisioned separately.

The public pool is the recorded reserve, not a continuous on-chain balance. Dedicated treasuries are checked when funding is recorded and before the reserve locks. Organizers remain able to withdraw funds; custody monitoring and enforceable escrow remain future work. Only one overlapping cash competition is permitted. No sponsor brands, commitments, cash balances or sample payments are invented by the app.

Eligibility evidence, sanctions screening, disputes, source reliability and jurisdiction review are organizer responsibilities. Self-declared residence alone does not approve cash entry. The registration check rejects all HYBRID plans even if an administrator creates their metadata through the API.

See [the mission model research](research/falcon-mission-model.md) for rationale and launch economics.
