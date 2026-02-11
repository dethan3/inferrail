import {
  type AcceptJobInput,
  type CreateJobInput,
  type Job,
  type RefundJobInput,
  type SettleJobInput,
  type SubmitResultInput,
  type TimelineEvent,
} from '../types';
import { type InferrailClient } from './inferrailClient';

interface SuiRpcCursor {
  txDigest: string;
  eventSeq: string;
}

interface SuiRpcEvent {
  id: SuiRpcCursor;
  parsedJson: Record<string, unknown>;
  timestampMs: string | null;
}

interface SuiQueryEventsResponse {
  data: SuiRpcEvent[];
  nextCursor: SuiRpcCursor | null;
  hasNextPage: boolean;
}

interface SuiClientConfig {
  network: SuiNetwork;
  rpcUrl: string;
  packageId: string;
  defaultCoinType: string;
  defaultGasBudget: number;
  defaultPaymentCoinObjectId: string;
  clockObjectId: string;
}

type SuiNetwork = 'testnet' | 'devnet' | 'mainnet';

type WalletAccount = string | { address?: string };

interface InjectedWallet {
  hasPermissions?: (permissions: string[]) => Promise<boolean>;
  requestPermissions?: (permissions: string[]) => Promise<unknown>;
  getAccounts?: () => Promise<WalletAccount[]>;
  getAccount?: () => Promise<WalletAccount>;
  executeMoveCall?: (input: {
    packageObjectId: string;
    module: string;
    function: string;
    typeArguments?: string[];
    arguments?: unknown[];
    gasBudget?: number;
  }) => Promise<unknown>;
  signAndExecuteTransactionBlock?: (input: {
    transactionBlock: string;
    options?: Record<string, unknown>;
    requestType?: string;
  }) => Promise<unknown>;
}

declare global {
  interface Window {
    suiWallet?: InjectedWallet;
    slush?: InjectedWallet;
    martian?: InjectedWallet;
  }
}

function normalizeAddress(value: string): string {
  return value.toLowerCase();
}

function numberFromUnknown(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new Error(`Invalid numeric value: ${value}`);
    }
    return parsed;
  }
  throw new Error(`Unexpected numeric shape: ${String(value)}`);
}

function stringFromUnknown(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error(`Unexpected string shape: ${String(value)}`);
  }
  return value;
}

function bytesToHex(value: unknown): string {
  if (!Array.isArray(value)) {
    return '';
  }
  return value
    .map((item) => Number(item).toString(16).padStart(2, '0'))
    .join('');
}

function makeTimelineId(prefix: string, cursor: SuiRpcCursor): string {
  return `${prefix}-${cursor.txDigest}-${cursor.eventSeq}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function hexToBytes(hex: string): number[] {
  const clean = hex.trim().toLowerCase().replace(/^0x/, '');
  if (!clean) {
    return [];
  }
  if (clean.length % 2 !== 0) {
    throw new Error('Result hash must be even-length hex');
  }
  if (!/^[0-9a-f]+$/.test(clean)) {
    throw new Error('Result hash must be hex characters only');
  }
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 2) {
    bytes.push(Number.parseInt(clean.slice(i, i + 2), 16));
  }
  return bytes;
}

function findWalletFromWindow(): InjectedWallet | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.suiWallet ?? window.slush ?? window.martian ?? null;
}

function getAddressFromWalletAccount(account: WalletAccount | null | undefined): string | null {
  if (!account) {
    return null;
  }
  if (typeof account === 'string') {
    return account;
  }
  if (typeof account.address === 'string') {
    return account.address;
  }
  return null;
}

function digestFromWalletResult(result: unknown): string | null {
  if (!result || typeof result !== 'object') {
    return null;
  }

  const asRecord = result as Record<string, unknown>;
  if (typeof asRecord.digest === 'string') {
    return asRecord.digest;
  }

  const effects = asRecord.effects;
  if (effects && typeof effects === 'object') {
    const effectsRecord = effects as Record<string, unknown>;
    if (typeof effectsRecord.transactionDigest === 'string') {
      return effectsRecord.transactionDigest;
    }
  }

  const effectsCert = asRecord.EffectsCert;
  if (effectsCert && typeof effectsCert === 'object') {
    const cert = (effectsCert as Record<string, unknown>).certificate;
    if (cert && typeof cert === 'object') {
      const txDigest = (cert as Record<string, unknown>).transactionDigest;
      if (typeof txDigest === 'string') {
        return txDigest;
      }
    }
  }

  return null;
}

interface UnsafeMoveCallResponse {
  txBytes?: string;
  tx_bytes?: string;
}

const NETWORK_RPC_MAP: Record<SuiNetwork, string> = {
  testnet: 'https://fullnode.testnet.sui.io:443',
  devnet: 'https://fullnode.devnet.sui.io:443',
  mainnet: 'https://fullnode.mainnet.sui.io:443',
};

function normalizeNetwork(value: string): SuiNetwork {
  const v = value.toLowerCase();
  if (v === 'mainnet' || v === 'devnet' || v === 'testnet') {
    return v;
  }
  return 'testnet';
}

export class SuiInferrailClient implements InferrailClient {
  private readonly config: SuiClientConfig;

  constructor(config?: Partial<SuiClientConfig>) {
    const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {};
    const envRpc = env.VITE_SUI_RPC_URL;
    const envNetwork = env.VITE_SUI_NETWORK;
    const envPackage = env.VITE_INFERRAIL_PACKAGE_ID;
    const envCoinType = env.VITE_INFERRAIL_COIN_TYPE;
    const envCoinObjectId = env.VITE_INFERRAIL_PAYMENT_COIN_OBJECT_ID;
    const network = normalizeNetwork(config?.network ?? envNetwork ?? 'testnet');
    const defaultRpcUrl = NETWORK_RPC_MAP[network];

    this.config = {
      network,
      rpcUrl: config?.rpcUrl ?? envRpc ?? defaultRpcUrl,
      packageId: normalizeAddress(config?.packageId ?? envPackage ?? ''),
      defaultCoinType: config?.defaultCoinType ?? envCoinType ?? '0x2::sui::SUI',
      defaultGasBudget: config?.defaultGasBudget ?? 100_000_000,
      defaultPaymentCoinObjectId: config?.defaultPaymentCoinObjectId ?? envCoinObjectId ?? '',
      clockObjectId: config?.clockObjectId ?? '0x6',
    };
  }

  private async rpcCall<T>(method: string, params: unknown[]): Promise<T> {
    const response = await fetch(this.config.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method,
        params,
      }),
    });

    if (!response.ok) {
      throw new Error(`RPC request failed: ${response.status}`);
    }

    const payload = (await response.json()) as {
      result?: T;
      error?: { message?: string };
    };

    if (payload.error) {
      throw new Error(payload.error.message ?? 'Unknown RPC error');
    }

    if (!payload.result) {
      throw new Error('RPC returned empty result');
    }

    return payload.result;
  }

  private async queryAllEvents(eventType: string): Promise<SuiRpcEvent[]> {
    let cursor: SuiRpcCursor | null = null;
    let hasNextPage = true;
    const out: SuiRpcEvent[] = [];

    while (hasNextPage) {
      const page: SuiQueryEventsResponse = await this.rpcCall<SuiQueryEventsResponse>(
        'suix_queryEvents',
        [{ MoveEventType: eventType }, cursor, 50, false],
      );
      out.push(...page.data);
      cursor = page.nextCursor;
      hasNextPage = page.hasNextPage;
    }

    return out;
  }

  private requirePackageId(): string {
    if (!this.config.packageId) {
      throw new Error('Missing VITE_INFERRAIL_PACKAGE_ID for Sui mode.');
    }
    return this.config.packageId;
  }

  private requireWallet(): InjectedWallet {
    const wallet = findWalletFromWindow();
    if (!wallet) {
      throw new Error('No injected Sui wallet found. Install/enable a Sui wallet extension.');
    }
    return wallet;
  }

  private async ensureWalletPermission(wallet: InjectedWallet): Promise<void> {
    if (!wallet.requestPermissions) {
      return;
    }
    if (wallet.hasPermissions) {
      const granted = await wallet.hasPermissions(['viewAccount', 'suggestTransactions']);
      if (granted) {
        return;
      }
    }
    await wallet.requestPermissions(['viewAccount', 'suggestTransactions']);
  }

  private async walletAddress(wallet: InjectedWallet): Promise<string> {
    if (wallet.getAccounts) {
      const accounts = await wallet.getAccounts();
      const first = accounts[0] ?? null;
      const address = getAddressFromWalletAccount(first);
      if (address) {
        return normalizeAddress(address);
      }
    }
    if (wallet.getAccount) {
      const account = await wallet.getAccount();
      const address = getAddressFromWalletAccount(account);
      if (address) {
        return normalizeAddress(address);
      }
    }
    throw new Error('Unable to read wallet account. Connect wallet and unlock it first.');
  }

  private async buildUnsafeMoveCallTx(params: {
    signer: string;
    module: string;
    func: string;
    typeArguments: string[];
    arguments: unknown[];
    gasBudget: number;
  }): Promise<string> {
    const pkg = this.requirePackageId();
    const response = await this.rpcCall<UnsafeMoveCallResponse>('unsafe_moveCall', [
      params.signer,
      pkg,
      params.module,
      params.func,
      params.typeArguments,
      params.arguments,
      null,
      params.gasBudget,
    ]);
    const txBytes = response.txBytes ?? response.tx_bytes;
    if (!txBytes) {
      throw new Error('unsafe_moveCall did not return tx bytes');
    }
    return txBytes;
  }

  private async executeMoveCall(params: {
    expectedSigner: string;
    module: string;
    func: string;
    typeArguments: string[];
    arguments: unknown[];
    gasBudget?: number;
  }): Promise<string> {
    this.requirePackageId();
    const wallet = this.requireWallet();
    await this.ensureWalletPermission(wallet);

    const signer = await this.walletAddress(wallet);
    if (normalizeAddress(params.expectedSigner) !== signer) {
      throw new Error(`Wallet signer mismatch. Expected ${params.expectedSigner}, got ${signer}`);
    }

    const gasBudget = params.gasBudget ?? this.config.defaultGasBudget;

    if (wallet.executeMoveCall) {
      const result = await wallet.executeMoveCall({
        packageObjectId: this.config.packageId,
        module: params.module,
        function: params.func,
        typeArguments: params.typeArguments,
        arguments: params.arguments,
        gasBudget,
      });
      return digestFromWalletResult(result) ?? '';
    }

    if (wallet.signAndExecuteTransactionBlock) {
      const txBytes = await this.buildUnsafeMoveCallTx({
        signer,
        module: params.module,
        func: params.func,
        typeArguments: params.typeArguments,
        arguments: params.arguments,
        gasBudget,
      });
      const result = await wallet.signAndExecuteTransactionBlock({
        transactionBlock: txBytes,
        options: {
          showEffects: true,
        },
        requestType: 'WaitForLocalExecution',
      });
      return digestFromWalletResult(result) ?? '';
    }

    throw new Error('Wallet does not support move call execution in this build.');
  }

  private async waitForJob(jobId: string): Promise<Job> {
    for (let i = 0; i < 8; i += 1) {
      const jobs = await this.listJobs();
      const found = jobs.find((job) => normalizeAddress(job.id) === normalizeAddress(jobId));
      if (found) {
        return found;
      }
      await sleep(800);
    }
    throw new Error('Transaction submitted but job state is not indexed yet. Retry refresh in a moment.');
  }

  private async waitForLatestRequesterJob(requester: string): Promise<Job> {
    for (let i = 0; i < 8; i += 1) {
      const jobs = await this.listJobs();
      const match = jobs
        .filter((job) => normalizeAddress(job.requester) === normalizeAddress(requester))
        .sort((a, b) => b.createdAtMs - a.createdAtMs)[0];
      if (match) {
        return match;
      }
      await sleep(800);
    }
    throw new Error('Create transaction submitted but new job not indexed yet.');
  }

  async listJobs(): Promise<Job[]> {
    const pkg = this.requirePackageId();

    const [createdEvents, acceptedEvents, submittedEvents, settledEvents, refundedEvents] =
      await Promise.all([
        this.queryAllEvents(`${pkg}::events::JobCreated`),
        this.queryAllEvents(`${pkg}::events::JobAccepted`),
        this.queryAllEvents(`${pkg}::events::ResultSubmitted`),
        this.queryAllEvents(`${pkg}::events::JobSettled`),
        this.queryAllEvents(`${pkg}::events::JobRefunded`),
      ]);

    const jobsById = new Map<string, Job>();

    const createdSorted = [...createdEvents].sort((a, b) => {
      const aMs = numberFromUnknown(a.parsedJson.created_at_ms);
      const bMs = numberFromUnknown(b.parsedJson.created_at_ms);
      return aMs - bMs;
    });

    createdSorted.forEach((event) => {
      const parsed = event.parsedJson;
      const jobId = normalizeAddress(stringFromUnknown(parsed.job_id));
      const requester = normalizeAddress(stringFromUnknown(parsed.requester));
      const createdAtMs = numberFromUnknown(parsed.created_at_ms);
      const budget = numberFromUnknown(parsed.budget);
      const deadlineMs = numberFromUnknown(parsed.deadline_ms);

      const timeline: TimelineEvent[] = [
        {
          id: makeTimelineId('created', event.id),
          type: 'JobCreated',
          actor: requester,
          atMs: createdAtMs,
          note: `Escrow locked: ${budget}`,
        },
      ];

      jobsById.set(jobId, {
        id: jobId,
        description: 'On-chain job (description not indexed in event payload)',
        budget,
        deadlineMs,
        requester,
        worker: null,
        status: 'Created',
        resultUri: null,
        resultHash: null,
        createdAtMs,
        updatedAtMs: createdAtMs,
        timeline,
      });
    });

    acceptedEvents.forEach((event) => {
      const parsed = event.parsedJson;
      const job = jobsById.get(normalizeAddress(stringFromUnknown(parsed.job_id)));
      if (!job) {
        return;
      }
      const worker = normalizeAddress(stringFromUnknown(parsed.worker));
      const atMs = numberFromUnknown(parsed.accepted_at_ms);
      job.worker = worker;
      job.status = 'Accepted';
      job.updatedAtMs = Math.max(job.updatedAtMs, atMs);
      job.timeline.push({
        id: makeTimelineId('accepted', event.id),
        type: 'JobAccepted',
        actor: worker,
        atMs,
        note: 'Worker accepted job',
      });
    });

    submittedEvents.forEach((event) => {
      const parsed = event.parsedJson;
      const job = jobsById.get(normalizeAddress(stringFromUnknown(parsed.job_id)));
      if (!job) {
        return;
      }
      const worker = normalizeAddress(stringFromUnknown(parsed.worker));
      const atMs = numberFromUnknown(parsed.submitted_at_ms);
      const hash = bytesToHex(parsed.result_hash);
      job.status = 'Submitted';
      job.worker = worker;
      job.resultHash = hash || null;
      job.updatedAtMs = Math.max(job.updatedAtMs, atMs);
      job.timeline.push({
        id: makeTimelineId('submitted', event.id),
        type: 'ResultSubmitted',
        actor: worker,
        atMs,
        note: hash ? `Result hash: ${hash.slice(0, 10)}...` : 'Result submitted',
      });
    });

    settledEvents.forEach((event) => {
      const parsed = event.parsedJson;
      const job = jobsById.get(normalizeAddress(stringFromUnknown(parsed.job_id)));
      if (!job) {
        return;
      }
      const requester = normalizeAddress(stringFromUnknown(parsed.requester));
      const worker = normalizeAddress(stringFromUnknown(parsed.worker));
      const payout = numberFromUnknown(parsed.payout);
      const atMs = numberFromUnknown(parsed.settled_at_ms);
      job.status = 'Settled';
      job.worker = worker;
      job.updatedAtMs = Math.max(job.updatedAtMs, atMs);
      job.timeline.push({
        id: makeTimelineId('settled', event.id),
        type: 'JobSettled',
        actor: requester,
        atMs,
        note: `Released ${payout} to worker`,
      });
    });

    refundedEvents.forEach((event) => {
      const parsed = event.parsedJson;
      const job = jobsById.get(normalizeAddress(stringFromUnknown(parsed.job_id)));
      if (!job) {
        return;
      }
      const requester = normalizeAddress(stringFromUnknown(parsed.requester));
      const refund = numberFromUnknown(parsed.refund);
      const atMs = numberFromUnknown(parsed.refunded_at_ms);
      job.status = 'Refunded';
      job.updatedAtMs = Math.max(job.updatedAtMs, atMs);
      job.timeline.push({
        id: makeTimelineId('refunded', event.id),
        type: 'JobRefunded',
        actor: requester,
        atMs,
        note: `Refunded ${refund} back to requester`,
      });
    });

    return [...jobsById.values()].sort((a, b) => b.createdAtMs - a.createdAtMs);
  }

  async createJob(input: CreateJobInput): Promise<Job> {
    const coinType = input.coinType ?? this.config.defaultCoinType;
    const paymentCoinObjectId = input.paymentCoinObjectId ?? this.config.defaultPaymentCoinObjectId;
    if (!paymentCoinObjectId) {
      throw new Error('Sui mode create_job needs payment coin object id.');
    }

    await this.executeMoveCall({
      expectedSigner: input.requester,
      module: 'task_market',
      func: 'create_job',
      typeArguments: [coinType],
      arguments: [input.description, input.deadlineMs, paymentCoinObjectId, this.config.clockObjectId],
      gasBudget: input.gasBudget,
    });

    return this.waitForLatestRequesterJob(input.requester);
  }

  async acceptJob(input: AcceptJobInput): Promise<Job> {
    const coinType = input.coinType ?? this.config.defaultCoinType;
    await this.executeMoveCall({
      expectedSigner: input.worker,
      module: 'task_market',
      func: 'accept_job',
      typeArguments: [coinType],
      arguments: [input.jobId, this.config.clockObjectId],
      gasBudget: input.gasBudget,
    });

    return this.waitForJob(input.jobId);
  }

  async submitResult(input: SubmitResultInput): Promise<Job> {
    const coinType = input.coinType ?? this.config.defaultCoinType;
    await this.executeMoveCall({
      expectedSigner: input.worker,
      module: 'task_market',
      func: 'submit_result',
      typeArguments: [coinType],
      arguments: [
        input.jobId,
        input.resultUri,
        hexToBytes(input.resultHash),
        this.config.clockObjectId,
      ],
      gasBudget: input.gasBudget,
    });

    return this.waitForJob(input.jobId);
  }

  async settleJob(input: SettleJobInput): Promise<Job> {
    const coinType = input.coinType ?? this.config.defaultCoinType;
    await this.executeMoveCall({
      expectedSigner: input.requester,
      module: 'task_market',
      func: 'settle_job',
      typeArguments: [coinType],
      arguments: [input.jobId, this.config.clockObjectId],
      gasBudget: input.gasBudget,
    });

    return this.waitForJob(input.jobId);
  }

  async refundJob(input: RefundJobInput): Promise<Job> {
    const coinType = input.coinType ?? this.config.defaultCoinType;
    await this.executeMoveCall({
      expectedSigner: input.requester,
      module: 'task_market',
      func: 'refund_job',
      typeArguments: [coinType],
      arguments: [input.jobId, this.config.clockObjectId],
      gasBudget: input.gasBudget,
    });

    return this.waitForJob(input.jobId);
  }
}
