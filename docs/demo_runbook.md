# InferRail Demo Runbook

This runbook is optimized for a 3-minute hackathon demo.

## 1. Environment Preparation

### Contract validation

```bash
cd contracts/inferrail
sui move test
```

Expected:
- `Total tests: 5; passed: 5; failed: 0`

### Frontend startup

```bash
cd app
pnpm install
pnpm dev
```

Open `http://localhost:5173`.

## 2. Demo Script A (Successful Settlement)

Fast path (recommended):
1. Select `Mock` mode.
2. Click `Seed Scenario A`.
3. Open the seeded job and show status `Settled`.
4. Read timeline events:
   - `JobCreated`
   - `JobAccepted`
   - `ResultSubmitted`
   - `JobSettled`

Full interactive path:
1. Create a new job as requester.
2. Switch role to worker and click `Accept Job`.
3. Generate hash and click `Submit`.
4. Switch role to requester and click `Settle`.
5. Show final status `Settled`.

## 3. Demo Script B (Timeout Refund)

Fast path (recommended):
1. Select `Mock` mode.
2. Click `Seed Scenario B`.
3. Ensure selected job is `Submitted` and already expired.
4. Click `Refund (Timeout)` as requester.
5. Show final status `Refunded` and timeline update.

Full interactive path:
1. Create a short-deadline job.
2. Accept and submit result.
3. Wait until deadline is expired.
4. Execute refund as requester.

## 4. Judge-facing Talking Points

- InferRail enforces delivery-to-payment flow with explicit state transitions.
- Escrow is locked before work starts, removing budget trust risk.
- Settlement and refund are deterministic and auditable via events.
- This is infrastructure for AI service payments, not a speculative token app.

## 5. Fallback Plan

If live chain write integration is unavailable, run the full logic in `Mock` mode and show:
- deterministic state transitions,
- permission checks,
- timeout refund branch,
- complete event timeline.
