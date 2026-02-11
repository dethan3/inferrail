# InferRail Submission Checklist

Use this checklist before final hackathon submission.

## 1. Repository Quality

- [ ] Repository is public and accessible.
- [ ] `README.md` includes architecture, setup, demo script, and constraints.
- [ ] Core docs are present:
  - `docs/product_plan.md`
  - `docs/development_plan.md`
  - `docs/contract_interface.md`
  - `docs/deployment_guide.md`
  - `docs/demo_runbook.md`
  - `docs/ai_tool_disclosure.md`

## 2. Smart Contract Readiness

- [ ] `contracts/inferrail` compiles successfully.
- [ ] `sui move test` passes (`5/5` or newer total if expanded).
- [ ] Lifecycle states verified:
  - `Created -> Accepted -> Submitted -> Settled`
  - timeout to `Refunded`
- [ ] Permission guards validated (requester/worker role checks).

## 3. Frontend Readiness

- [ ] App starts with `pnpm dev`.
- [ ] Mock mode demonstrates full create/accept/submit/settle/refund flow.
- [ ] Scenario seed buttons verified:
  - `Seed Scenario A`
  - `Seed Scenario B`
- [ ] Timeline UI clearly reflects state transitions.
- [ ] Build passes with `pnpm build`.

## 4. Deployment and Demo Evidence

- [ ] Testnet package published.
- [ ] `packageId` recorded.
- [ ] Demo URL is available.
- [ ] Demo video recorded (2-4 minutes preferred).
- [ ] At least one successful settle path demonstrated.
- [ ] At least one timeout refund path demonstrated.

## 5. Submission Metadata

- [ ] Project pitch text finalized (`docs/pitch_narrative.md`).
- [ ] Track alignment to Stablelayer stated clearly.
- [ ] Sui usage and technical novelty explained succinctly.
- [ ] AI tool disclosure completed (`docs/ai_tool_disclosure.md`).

## 6. Final Packaging

- [ ] Branch is clean and committed.
- [ ] Optional tag created for submission snapshot.
- [ ] README links verified.
- [ ] All placeholders replaced (package id, urls, tx digests, video link).
