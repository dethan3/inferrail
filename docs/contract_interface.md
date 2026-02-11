# InferRail Contract Interface

This document summarizes the on-chain API in `contracts/inferrail` for frontend and integration work.

## Package

- Package name: `inferrail`
- Address alias in source: `inferrail = 0x0` (replace at publish time)

## Main Module

- Module: `task_market`
- Object: `Job<CoinType>` (shared object)

## State Enum (internal values)

- `0` = `Created`
- `1` = `Accepted`
- `2` = `Submitted`
- `3` = `Settled`
- `4` = `Refunded`

## Entry API

### `create_job<CoinType>(description, deadline_ms, payment, clock, ctx)`

- Creates a shared `Job<CoinType>`
- Locks `payment` into escrow
- Preconditions:
  - `deadline_ms > current_clock_ms`
  - `payment.value > 0`

### `accept_job<CoinType>(job, clock, ctx)`

- Worker accepts a `Created` job
- Preconditions:
  - `job.status == Created`
  - caller is not requester
  - not expired

### `submit_result<CoinType>(job, result_uri, result_hash, clock, ctx)`

- Assigned worker submits result proof
- Preconditions:
  - `job.status == Accepted`
  - caller is assigned worker
  - not expired

### `settle_job<CoinType>(job, clock, ctx)`

- Requester settles submitted job
- Preconditions:
  - `job.status == Submitted`
  - caller is requester
- Effect:
  - Releases escrow to worker
  - Sets status to `Settled`

### `refund_job<CoinType>(job, clock, ctx)`

- Requester refunds expired job
- Preconditions:
  - `job.status in {Created, Accepted, Submitted}`
  - caller is requester
  - expired
- Effect:
  - Returns escrow to requester
  - Sets status to `Refunded`

## Events

- `JobCreated`
- `JobAccepted`
- `ResultSubmitted`
- `JobSettled`
- `JobRefunded`

## Abort Codes

Defined in `errors.move`.

- `1` invalid deadline
- `2` invalid budget
- `3` invalid state
- `4` only requester can settle
- `5` only requester can refund
- `6` only worker can submit
- `7` job not expired
- `8` job already expired
- `9` requester cannot accept own job

## Test Coverage

See `contracts/inferrail/tests/task_market_tests.move`.

- happy path settlement
- non-worker submission rejection
- refund rejection before deadline
- requester self-accept rejection
- timeout refund path
