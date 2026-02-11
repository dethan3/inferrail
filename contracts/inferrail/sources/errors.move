module inferrail::errors;

const E_INVALID_DEADLINE: u64 = 1;
const E_INVALID_BUDGET: u64 = 2;
const E_INVALID_STATE: u64 = 3;
const E_ONLY_REQUESTER_CAN_SETTLE: u64 = 4;
const E_ONLY_REQUESTER_CAN_REFUND: u64 = 5;
const E_ONLY_WORKER_CAN_SUBMIT: u64 = 6;
const E_JOB_NOT_EXPIRED: u64 = 7;
const E_JOB_ALREADY_EXPIRED: u64 = 8;
const E_REQUESTER_CANNOT_ACCEPT: u64 = 9;

public fun invalid_deadline(): u64 {
    E_INVALID_DEADLINE
}

public fun invalid_budget(): u64 {
    E_INVALID_BUDGET
}

public fun invalid_state(): u64 {
    E_INVALID_STATE
}

public fun only_requester_can_settle(): u64 {
    E_ONLY_REQUESTER_CAN_SETTLE
}

public fun only_requester_can_refund(): u64 {
    E_ONLY_REQUESTER_CAN_REFUND
}

public fun only_worker_can_submit(): u64 {
    E_ONLY_WORKER_CAN_SUBMIT
}

public fun job_not_expired(): u64 {
    E_JOB_NOT_EXPIRED
}

public fun job_already_expired(): u64 {
    E_JOB_ALREADY_EXPIRED
}

public fun requester_cannot_accept(): u64 {
    E_REQUESTER_CANNOT_ACCEPT
}
