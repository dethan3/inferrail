# InferRail Deployment Guide

## 1. Prerequisites

- Sui CLI installed (`sui --version`)
- A funded Sui testnet address
- Node.js + pnpm for frontend

## 2. Run Contract Tests

```bash
cd contracts/inferrail
sui move test
```

## 3. Publish Package (Testnet)

```bash
cd contracts/inferrail
sui client switch --env testnet
sui client publish --gas-budget 200000000
```

After publish:

- Record `packageId`
- Record module path `::task_market`

## 4. Frontend Setup

```bash
cd app
cp .env.example .env
```

Set in `.env`:

- `VITE_SUI_NETWORK` (`testnet` recommended for now)
- `VITE_SUI_RPC_URL` (default testnet fullnode is acceptable)
- `VITE_INFERRAIL_PACKAGE_ID` (published package ID)
- `VITE_INFERRAIL_COIN_TYPE` (typically `0x2::sui::SUI`)
- `VITE_INFERRAIL_PAYMENT_COIN_OBJECT_ID` (coin object used in `create_job`)

Then run:

```bash
pnpm install
pnpm dev
```

Optional unified check:

```bash
./scripts/verify.sh
```

## 5. Demo Modes

- `Mock` mode:
  - full create/accept/submit/settle/refund flow
  - local timeline via browser storage
  - one-click seeded demo cases via `Seed Scenario A` / `Seed Scenario B`
- `Sui` mode:
  - timeline from on-chain events
  - write actions through injected wallet signing
  - wallet address must match requester/worker input
  - network can be selected in UI (`testnet/devnet/mainnet`, default `testnet`)
  - `create_job` currently requires a pre-selected payment coin object id

## 6. Next Integration Step (PTB UX polish)

Enhance `app/src/lib/suiInferrailClient.ts`:

- add PTB coin split flow so users enter budget amount without manually choosing payment coin object id
- add stronger wallet-standard compatibility layer across extensions

## 7. Submission Preparation

- Follow `docs/demo_runbook.md` for rehearsal.
- Complete `docs/submission_checklist.md`.
- Fill `docs/ai_tool_disclosure.md` before final submission.
