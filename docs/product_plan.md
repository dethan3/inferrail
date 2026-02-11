# InferRail Product Plan

## 1. Product Vision

Build a practical settlement layer for AI inference outsourcing where delivery and payment are both verifiable.

## 2. Problem Statement

Current AI task outsourcing is fragmented:

- Task scope is negotiated in chat tools.
- Delivery proof is weak or unverifiable.
- Payment settlement is manual and dispute-prone.

This creates operational risk for both buyers and providers.

## 3. Target Users

- AI builders who need external inference work.
- Independent inference service providers.
- Small teams running model pipelines for clients.

## 4. Jobs To Be Done

- As a requester, I want to publish a job and lock payment once, so workers trust the budget is real.
- As a worker, I want to submit output proof and get paid without follow-up chasing.
- As both sides, I want a clear immutable timeline to resolve disputes.

## 5. Product Principles

- Rule clarity over legal ambiguity.
- Simple state machine over feature bloat.
- Real payments over speculative token mechanics.
- Auditability over opaque automation.

## 6. MVP Feature Set

### P0 (Must-have)

- Create job with structured fields.
- Escrow lock on publish.
- Single-worker acceptance.
- Result submission with URI + hash.
- Accept and settle flow.
- Timeout refund flow.
- Timeline UI from on-chain events.

### P1 (Nice-to-have if time allows)

- Optional requester notes on acceptance/rejection.
- Worker reputation summary from completed jobs.
- Basic notification hooks.

## 7. User Flow (MVP)

1. Requester creates job and deposits budget.
2. Worker accepts job.
3. Worker submits result proof.
4. Requester settles before deadline.
5. If deadline exceeded and conditions met, refund path is enabled.

## 8. Differentiation

Compared with generic escrow:

- Purpose-built for AI inference job lifecycle.
- Built-in result proof field (URI + hash).
- Optimized for fast, low-cost state updates on Sui.
- Stable settlement narrative aligned with Stablelayer track.

## 9. Success Metrics

Hackathon metrics:

- End-to-end demo completes without manual intervention.
- At least 2 successful settlement transactions in demo.
- One timeout refund scenario demonstrated.

Post-hackathon product metrics:

- Job completion rate.
- Median settlement time.
- Dispute/refund rate.

## 10. Risks and Mitigations

- Risk: low-quality submission accepted accidentally.
  - Mitigation: explicit acceptance step + result hash visibility.
- Risk: scope creep in hackathon timeline.
  - Mitigation: strict P0-only scope and freeze.
- Risk: unclear judging story.
  - Mitigation: single narrative centered on trustless delivery-to-payment pipeline.

## 11. Track Fit

- Stablelayer: stable-value settlement path for AI services.
- Sui: object-centric state machine and efficient transaction execution.

## 12. Out of Scope

- Multi-party arbitration governance.
- Decentralized GPU orchestration network.
- Full cryptographic proof of model execution.
