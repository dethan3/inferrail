#[allow(duplicate_alias, unused_field)]
module inferrail::events;

use sui::event;
use sui::object::ID;

public struct JobCreated has copy, drop {
    job_id: ID,
    requester: address,
    budget: u64,
    deadline_ms: u64,
    created_at_ms: u64,
}

public struct JobAccepted has copy, drop {
    job_id: ID,
    worker: address,
    accepted_at_ms: u64,
}

public struct ResultSubmitted has copy, drop {
    job_id: ID,
    worker: address,
    result_hash: vector<u8>,
    submitted_at_ms: u64,
}

public struct JobSettled has copy, drop {
    job_id: ID,
    requester: address,
    worker: address,
    payout: u64,
    settled_at_ms: u64,
}

public struct JobRefunded has copy, drop {
    job_id: ID,
    requester: address,
    refund: u64,
    refunded_at_ms: u64,
}

public(package) fun emit_job_created(
    job_id: ID,
    requester: address,
    budget: u64,
    deadline_ms: u64,
    created_at_ms: u64,
) {
    event::emit(JobCreated {
        job_id,
        requester,
        budget,
        deadline_ms,
        created_at_ms,
    });
}

public(package) fun emit_job_accepted(job_id: ID, worker: address, accepted_at_ms: u64) {
    event::emit(JobAccepted {
        job_id,
        worker,
        accepted_at_ms,
    });
}

public(package) fun emit_result_submitted(
    job_id: ID,
    worker: address,
    result_hash: vector<u8>,
    submitted_at_ms: u64,
) {
    event::emit(ResultSubmitted {
        job_id,
        worker,
        result_hash,
        submitted_at_ms,
    });
}

public(package) fun emit_job_settled(
    job_id: ID,
    requester: address,
    worker: address,
    payout: u64,
    settled_at_ms: u64,
) {
    event::emit(JobSettled {
        job_id,
        requester,
        worker,
        payout,
        settled_at_ms,
    });
}

public(package) fun emit_job_refunded(
    job_id: ID,
    requester: address,
    refund: u64,
    refunded_at_ms: u64,
) {
    event::emit(JobRefunded {
        job_id,
        requester,
        refund,
        refunded_at_ms,
    });
}
