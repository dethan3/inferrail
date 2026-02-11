#[test_only]
module inferrail::task_market_tests;

use std::string;
use inferrail::task_market;

public struct TEST_COIN has drop, store {}

#[test]
fun test_happy_path_settlement() {
    let requester = @0xA;
    let worker = @0xB;
    let mut ctx = sui::tx_context::dummy();
    let mut job = task_market::new_job_for_testing<TEST_COIN>(requester, 100, 10, &mut ctx);

    task_market::accept_for_testing(&mut job, worker, 20);
    task_market::submit_for_testing(&mut job, worker, string::utf8(b"ipfs://result"), b"hash", 30);
    task_market::settle_for_testing(&mut job, requester, 40, &mut ctx);

    assert!(task_market::status(&job) == 3, 0);
    task_market::destroy_for_testing(job);
}

#[test, expected_failure(abort_code = 6, location = ::inferrail::task_market)]
fun test_only_worker_can_submit() {
    let requester = @0xA;
    let worker = @0xB;
    let attacker = @0xC;
    let mut ctx = sui::tx_context::dummy();
    let mut job = task_market::new_job_for_testing<TEST_COIN>(requester, 100, 10, &mut ctx);

    task_market::accept_for_testing(&mut job, worker, 20);
    task_market::submit_for_testing(&mut job, attacker, string::utf8(b"bad"), b"bad", 30);
    task_market::destroy_for_testing(job);
}

#[test, expected_failure(abort_code = 7, location = ::inferrail::task_market)]
fun test_refund_blocked_before_deadline() {
    let requester = @0xA;
    let mut ctx = sui::tx_context::dummy();
    let mut job = task_market::new_job_for_testing<TEST_COIN>(requester, 100, 10, &mut ctx);

    task_market::refund_for_testing(&mut job, requester, 99, &mut ctx);
    task_market::destroy_for_testing(job);
}

#[test]
fun test_timeout_refund_path() {
    let requester = @0xA;
    let worker = @0xB;
    let mut ctx = sui::tx_context::dummy();
    let mut job = task_market::new_job_for_testing<TEST_COIN>(requester, 100, 10, &mut ctx);

    task_market::accept_for_testing(&mut job, worker, 20);
    task_market::refund_for_testing(&mut job, requester, 101, &mut ctx);

    assert!(task_market::status(&job) == 4, 1);
    task_market::destroy_for_testing(job);
}

#[test, expected_failure(abort_code = 9, location = ::inferrail::task_market)]
fun test_requester_cannot_accept_own_job() {
    let requester = @0xA;
    let mut ctx = sui::tx_context::dummy();
    let mut job = task_market::new_job_for_testing<TEST_COIN>(requester, 100, 10, &mut ctx);

    task_market::accept_for_testing(&mut job, requester, 20);
    task_market::destroy_for_testing(job);
}
