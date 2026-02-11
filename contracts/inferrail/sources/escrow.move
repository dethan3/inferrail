#[allow(duplicate_alias)]
module inferrail::escrow;

use sui::balance::{Self as balance, Balance};
use sui::coin;
use sui::transfer;
use sui::tx_context::TxContext;

public(package) fun lock_funds<CoinType>(payment: coin::Coin<CoinType>): Balance<CoinType> {
    coin::into_balance(payment)
}

public(package) fun release_all_to<CoinType>(
    escrow: &mut Balance<CoinType>,
    recipient: address,
    ctx: &mut TxContext,
): u64 {
    let payout = balance::value(escrow);
    if (payout > 0) {
        let released_balance = balance::split(escrow, payout);
        let released_coin = coin::from_balance(released_balance, ctx);
        transfer::public_transfer(released_coin, recipient);
    };
    payout
}

public(package) fun refund_all_to<CoinType>(
    escrow: &mut Balance<CoinType>,
    recipient: address,
    ctx: &mut TxContext,
): u64 {
    release_all_to(escrow, recipient, ctx)
}
