# InferRail

InferRail is an on-chain escrow and settlement rail for AI inference jobs on Sui.
This repository targets the Stablelayer track for Vibe Sui Spring Fest 2026.

## One-line Pitch

From trust-based AI outsourcing to rule-based AI delivery: publish a job, lock funds, submit result proof, and settle automatically.

## What Is Implemented

### On-chain (Sui Move)

- Job lifecycle object with explicit states:
  `Created -> Accepted -> Submitted -> Settled`
- Timeout refund branch:
  `Created/Accepted/Submitted -> Refunded`
- Escrow lock/release/refund primitives
- Event emission for timeline/indexing
- Unit tests for happy path + permission/time guards

### Frontend (React + TypeScript)

- Job creation flow (description, budget, deadline)
- Role-based actions (requester / worker)
- Accept, submit result proof (URI + SHA-256 hash), settle, refund
- Timeline panel for each job
- Demo-ready Mock client (`localStorage`)
- One-click demo scenario seeding (Scenario A/B)
- Sui RPC event reader client (builds timeline from on-chain events)
- Sui write path via injected wallet move-call signing

## Repository Structure

```text
inferrail/
  README.md
  .gitignore
  contracts/
    inferrail/
      Move.toml
      sources/
        errors.move
        escrow.move
        events.move
        task_market.move
      tests/
        task_market_tests.move
  app/
    package.json
    index.html
    src/
      App.tsx
      styles.css
      types.ts
      lib/
        inferrailClient.ts
        mockInferrailClient.ts
        suiInferrailClient.ts
        hash.ts
  docs/
    ai_tool_disclosure.md
    contract_interface.md
    demo_runbook.md
    deployment_guide.md
    product_plan.md
    development_plan.md
    pitch_narrative.md
    submission_checklist.md
  scripts/
    verify.sh
```

## Quick Start

### 1. Contract Tests

```bash
cd contracts/inferrail
sui move test
```

Expected result:
- 5/5 tests pass in `task_market_tests.move`.

### 2. Frontend (Local Demo)

```bash
cd app
pnpm install
pnpm dev
```

Open `http://localhost:5173`.

Optional environment variables for Sui read mode:

```bash
VITE_SUI_NETWORK=testnet
VITE_SUI_RPC_URL=https://fullnode.testnet.sui.io:443
VITE_INFERRAIL_PACKAGE_ID=0x<your_published_package_id>
VITE_INFERRAIL_COIN_TYPE=0x2::sui::SUI
VITE_INFERRAIL_PAYMENT_COIN_OBJECT_ID=0x<coin_object_for_create_job>
```

Template file: `app/.env.example`.

Testnet notes:
- `VITE_INFERRAIL_PACKAGE_ID` must come from publishing your Move package to testnet.
- `VITE_INFERRAIL_PAYMENT_COIN_OBJECT_ID` is a coin object in the same testnet wallet as requester.
- Use `sui client gas` on testnet to list spendable coin object IDs.

### 3. Build Frontend

```bash
cd app
pnpm build
pnpm preview
```

### 4. Unified Verification Script

```bash
./scripts/verify.sh
```

This runs:
- `sui move test`
- `pnpm build` (if `app/node_modules` is available)

## Contract Modules

- `contracts/inferrail/sources/task_market.move`
  - `create_job`
  - `accept_job`
  - `submit_result`
  - `settle_job`
  - `refund_job`
- `contracts/inferrail/sources/escrow.move`
  - `lock_funds`
  - `release_all_to`
  - `refund_all_to`
- `contracts/inferrail/sources/events.move`
  - `JobCreated`
  - `JobAccepted`
  - `ResultSubmitted`
  - `JobSettled`
  - `JobRefunded`
- `contracts/inferrail/sources/errors.move`
  - centralized abort code accessors

## Demo Script (3 Minutes)

Detailed runbook: `docs/demo_runbook.md`

### Scenario A: Successful Settlement

0. (Optional) Click `Seed Scenario A` in Mock mode for instant setup.
1. Requester creates job with budget + deadline.
2. Worker accepts job.
3. Worker submits `result_uri` + `result_hash`.
4. Requester settles job.
5. Show final status `Settled` and timeline trail.

### Scenario B: Timeout Refund

0. (Optional) Click `Seed Scenario B` in Mock mode for instant setup.
1. Requester creates job with short deadline.
2. Wait until deadline passes without settlement.
3. Requester triggers refund.
4. Show final status `Refunded` and timeline trail.

## Current Gaps (Hackathon Next Steps)

- Validate wallet compatibility across more extensions (some wallets may not expose the same injected API shape).
- Add PTB-based coin split flow to avoid requiring a pre-split payment coin object id for `create_job`.
- Add event indexer/API for chain-driven timeline (instead of mock storage).
- Deploy contract package and publish package ID/network config in frontend.

## Submission Toolkit

- `docs/submission_checklist.md` for pre-submit gating
- `docs/ai_tool_disclosure.md` for AI usage declaration
- `docs/demo_runbook.md` for deterministic live demo flow

## Hackathon Compliance Notes

- New project for this hackathon window.
- Move 2024 syntax package.
- Public repo with runnable flows and docs.
- AI tool usage should be disclosed in submission materials.

## AI Tool Disclosure Template

We used AI tools during development.

- Tool and model:
- Major prompts:
- Generated artifacts:
- Human review and edits:
