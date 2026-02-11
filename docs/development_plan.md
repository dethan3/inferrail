# InferRail Development Plan

## 1. Objective

Deliver a hackathon-ready MVP with contracts, frontend demo, and submission-quality documentation.

## 2. Execution Status (as of February 11, 2026)

### Completed

- Move package scaffolded under `contracts/inferrail`.
- Core modules implemented:
  - `task_market.move`
  - `escrow.move`
  - `events.move`
  - `errors.move`
- State machine implemented:
  - `Created -> Accepted -> Submitted -> Settled`
  - Timeout branch to `Refunded`
- Move tests implemented and passing (`5/5`):
  - happy path settle
  - only worker can submit
  - refund blocked before deadline
  - requester cannot accept own job
  - timeout refund path
- Frontend MVP scaffolded under `app/`:
  - create/accept/submit/settle/refund flows
  - per-job timeline panel
  - role switcher for requester/worker demo
  - SHA-256 result hash helper
  - local demo data layer (mock client)
  - Sui RPC read client for on-chain event timeline
- Sui write path implemented in frontend client:
  - create/accept/submit/settle/refund now invoke on-chain entry functions through injected wallet signing
  - Sui network selection exposed in UI (default testnet)
  - frontend build now passes (`pnpm build`)
- Root README updated with run instructions and demo script.
- Demo and submission docs prepared:
  - `docs/demo_runbook.md`
  - `docs/submission_checklist.md`
  - `docs/ai_tool_disclosure.md`
- Unified verification script added:
  - `scripts/verify.sh`

### In Progress

- PTB UX polish for `create_job` coin splitting (remove manual payment coin object requirement).
- Event indexer/API for chain-backed timeline rendering.

### Blocked in current environment

- Intermittent DNS failures (`EAI_AGAIN` to `registry.npmjs.org`) still occur during new dependency installs, so dependency expansion may require retry windows.

## 3. Workstreams

- Smart contracts (Move).
- Frontend dApp.
- Integration and event timeline.
- QA, demo assets, and submission package.

## 4. Timeline (24-hour sprint template)

### Hour 0-3: Contract skeleton

- Define resources and state enums.
- Implement create and escrow lock.
- Implement accept flow.

Exit criteria:

- Compile passes.
- Core state transitions are enforceable.

### Hour 3-7: Submission and settlement logic

- Implement submit result.
- Implement accept-settle path.
- Implement timeout refund path.

Exit criteria:

- Unit tests cover happy path + timeout branch.

### Hour 7-12: Frontend core screens

- Job list and job details.
- Create job form.
- Worker accept and submit actions.
- Requester settle/refund actions.

Exit criteria:

- Wallet-connected user can complete end-to-end flow.

### Hour 12-16: Integration polish

- Parse and show transaction states.
- Build event timeline panel.
- Improve error messages.

Exit criteria:

- Users can understand each failure reason without logs.

### Hour 16-20: QA and demo rehearsal

- Execute scenario A: successful settlement.
- Execute scenario B: timeout refund.
- Record transaction IDs and screenshots.

Exit criteria:

- Two deterministic demo scripts validated.

### Hour 20-24: Submission packaging

- Finalize README and docs.
- Write deployment steps.
- Prepare AI tool disclosure section.
- Record short demo video.

Exit criteria:

- Repo is public-ready and judge-friendly.

## 5. Task Breakdown

### Contracts

- `task_market.move`
  - `create_job`
  - `accept_job`
  - `submit_result`
  - `settle_job`
  - `refund_job`
- `escrow.move`
  - `lock_funds`
  - `release_all_to`
  - `refund_all_to`
- `events.move`
  - `JobCreated`
  - `JobAccepted`
  - `ResultSubmitted`
  - `JobSettled`
  - `JobRefunded`

### Frontend

- Requester flow page state.
- Worker flow page state.
- Shared timeline component.
- Chain client interface abstraction.

## 6. Test Plan

- Unit tests:
  - invalid state transitions revert.
  - only requester can settle.
  - timeout gates refund path.
- Integration tests (target):
  - create -> accept -> submit -> settle.
  - create -> accept -> timeout -> refund.

## 7. Definition of Done

- Contract tests pass.
- Frontend can execute two scripted scenarios.
- README includes setup, architecture, and demo flow.
- Submission artifacts complete.

## 8. Post-MVP Backlog

- PTB coin split flow for `create_job`.
- Wallet-standard compatibility hardening across extensions.
- Chain event indexer.
- Multi-worker bidding mode.
- Reputation scoring.
- Pluggable verification adapters.
- Multi-step milestone mode.
