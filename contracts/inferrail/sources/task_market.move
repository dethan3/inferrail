#[allow(duplicate_alias)]
module inferrail::task_market;

use std::option::{Self as option};
use std::string;
use std::string::String;
use sui::balance::{Self as balance, Balance};
use sui::clock::{Self as clock, Clock};
use sui::coin;
use sui::object::{Self as object, ID, UID};
use sui::transfer;
use sui::tx_context::{Self as tx_context, TxContext};

use inferrail::errors;
use inferrail::escrow;
use inferrail::events;

const STATUS_CREATED: u8 = 0;
const STATUS_ACCEPTED: u8 = 1;
const STATUS_SUBMITTED: u8 = 2;
const STATUS_SETTLED: u8 = 3;
const STATUS_REFUNDED: u8 = 4;

public struct Job<phantom CoinType> has key {
    id: UID,
    requester: address,
    worker: option::Option<address>,
    description: String,
    budget: u64,
    deadline_ms: u64,
    status: u8,
    result_uri: option::Option<String>,
    result_hash: option::Option<vector<u8>>,
    created_at_ms: u64,
    updated_at_ms: u64,
    escrow: Balance<CoinType>,
}

public fun create_job<CoinType>(
    description: String,
    deadline_ms: u64,
    payment: coin::Coin<CoinType>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let requester = tx_context::sender(ctx);
    let now_ms = clock::timestamp_ms(clock);
    assert!(deadline_ms > now_ms, errors::invalid_deadline());

    let budget = coin::value(&payment);
    assert!(budget > 0, errors::invalid_budget());
    let locked_escrow = escrow::lock_funds(payment);

    let job = Job {
        id: object::new(ctx),
        requester,
        worker: option::none(),
        description,
        budget,
        deadline_ms,
        status: STATUS_CREATED,
        result_uri: option::none(),
        result_hash: option::none(),
        created_at_ms: now_ms,
        updated_at_ms: now_ms,
        escrow: locked_escrow,
    };
    let job_id = object::id(&job);
    events::emit_job_created(job_id, requester, budget, deadline_ms, now_ms);
    transfer::share_object(job);
}

public fun accept_job<CoinType>(job: &mut Job<CoinType>, clock: &Clock, ctx: &TxContext) {
    let sender = tx_context::sender(ctx);
    let now_ms = clock::timestamp_ms(clock);
    accept_job_internal(job, sender, now_ms);
}

public fun submit_result<CoinType>(
    job: &mut Job<CoinType>,
    result_uri: String,
    result_hash: vector<u8>,
    clock: &Clock,
    ctx: &TxContext,
) {
    let sender = tx_context::sender(ctx);
    let now_ms = clock::timestamp_ms(clock);
    submit_result_internal(job, sender, result_uri, result_hash, now_ms);
}

public fun settle_job<CoinType>(job: &mut Job<CoinType>, clock: &Clock, ctx: &mut TxContext) {
    let sender = tx_context::sender(ctx);
    let now_ms = clock::timestamp_ms(clock);
    settle_job_internal(job, sender, now_ms, ctx);
}

public fun refund_job<CoinType>(job: &mut Job<CoinType>, clock: &Clock, ctx: &mut TxContext) {
    let sender = tx_context::sender(ctx);
    let now_ms = clock::timestamp_ms(clock);
    refund_job_internal(job, sender, now_ms, ctx);
}

public fun id<CoinType>(job: &Job<CoinType>): ID {
    object::id(job)
}

public fun requester<CoinType>(job: &Job<CoinType>): address {
    job.requester
}

public fun has_worker<CoinType>(job: &Job<CoinType>): bool {
    option::is_some(&job.worker)
}

public fun budget<CoinType>(job: &Job<CoinType>): u64 {
    job.budget
}

public fun deadline_ms<CoinType>(job: &Job<CoinType>): u64 {
    job.deadline_ms
}

public fun status<CoinType>(job: &Job<CoinType>): u8 {
    job.status
}

public fun result_hash<CoinType>(job: &Job<CoinType>): option::Option<vector<u8>> {
    copy job.result_hash
}

fun accept_job_internal<CoinType>(job: &mut Job<CoinType>, sender: address, now_ms: u64) {
    assert!(job.status == STATUS_CREATED, errors::invalid_state());
    assert!(sender != job.requester, errors::requester_cannot_accept());
    assert!(now_ms <= job.deadline_ms, errors::job_already_expired());

    job.worker = option::some(sender);
    job.status = STATUS_ACCEPTED;
    job.updated_at_ms = now_ms;
    events::emit_job_accepted(object::id(job), sender, now_ms);
}

fun submit_result_internal<CoinType>(
    job: &mut Job<CoinType>,
    sender: address,
    result_uri: String,
    result_hash: vector<u8>,
    now_ms: u64,
) {
    assert!(job.status == STATUS_ACCEPTED, errors::invalid_state());
    assert!(now_ms <= job.deadline_ms, errors::job_already_expired());

    let worker = option::borrow(&job.worker);
    assert!(*worker == sender, errors::only_worker_can_submit());

    job.result_uri = option::some(result_uri);
    job.result_hash = option::some(copy result_hash);
    job.status = STATUS_SUBMITTED;
    job.updated_at_ms = now_ms;
    events::emit_result_submitted(object::id(job), sender, result_hash, now_ms);
}

fun settle_job_internal<CoinType>(
    job: &mut Job<CoinType>,
    sender: address,
    now_ms: u64,
    ctx: &mut TxContext,
) {
    assert!(job.status == STATUS_SUBMITTED, errors::invalid_state());
    assert!(sender == job.requester, errors::only_requester_can_settle());

    let worker = *option::borrow(&job.worker);
    let payout = escrow::release_all_to(&mut job.escrow, worker, ctx);

    job.status = STATUS_SETTLED;
    job.updated_at_ms = now_ms;
    events::emit_job_settled(object::id(job), sender, worker, payout, now_ms);
}

fun refund_job_internal<CoinType>(
    job: &mut Job<CoinType>,
    sender: address,
    now_ms: u64,
    ctx: &mut TxContext,
) {
    assert!(
        job.status == STATUS_CREATED || job.status == STATUS_ACCEPTED || job.status == STATUS_SUBMITTED,
        errors::invalid_state(),
    );
    assert!(sender == job.requester, errors::only_requester_can_refund());
    assert!(now_ms > job.deadline_ms, errors::job_not_expired());

    let refund = escrow::refund_all_to(&mut job.escrow, sender, ctx);
    job.status = STATUS_REFUNDED;
    job.updated_at_ms = now_ms;
    events::emit_job_refunded(object::id(job), sender, refund, now_ms);
}

#[test_only]
public fun new_job_for_testing<CoinType>(
    requester: address,
    deadline_ms: u64,
    now_ms: u64,
    ctx: &mut TxContext,
): Job<CoinType> {
    Job {
        id: object::new(ctx),
        requester,
        worker: option::none(),
        description: string::utf8(b"test job"),
        budget: 0,
        deadline_ms,
        status: STATUS_CREATED,
        result_uri: option::none(),
        result_hash: option::none(),
        created_at_ms: now_ms,
        updated_at_ms: now_ms,
        escrow: balance::zero(),
    }
}

#[test_only]
public fun accept_for_testing<CoinType>(job: &mut Job<CoinType>, worker: address, now_ms: u64) {
    accept_job_internal(job, worker, now_ms);
}

#[test_only]
public fun submit_for_testing<CoinType>(
    job: &mut Job<CoinType>,
    worker: address,
    result_uri: String,
    result_hash: vector<u8>,
    now_ms: u64,
) {
    submit_result_internal(job, worker, result_uri, result_hash, now_ms);
}

#[test_only]
public fun settle_for_testing<CoinType>(
    job: &mut Job<CoinType>,
    requester: address,
    now_ms: u64,
    ctx: &mut TxContext,
) {
    settle_job_internal(job, requester, now_ms, ctx);
}

#[test_only]
public fun refund_for_testing<CoinType>(
    job: &mut Job<CoinType>,
    requester: address,
    now_ms: u64,
    ctx: &mut TxContext,
) {
    refund_job_internal(job, requester, now_ms, ctx);
}

#[test_only]
public fun destroy_for_testing<CoinType>(job: Job<CoinType>) {
    let Job {
        id,
        requester: _,
        worker: _,
        description: _,
        budget: _,
        deadline_ms: _,
        status: _,
        result_uri: _,
        result_hash: _,
        created_at_ms: _,
        updated_at_ms: _,
        escrow,
    } = job;
    object::delete(id);
    balance::destroy_zero(escrow);
}
