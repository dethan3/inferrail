import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ConnectButton,
  useCurrentAccount,
  useCurrentWallet,
  useDisconnectWallet,
  useSignAndExecuteTransaction,
  useSuiClientContext,
} from '@mysten/dapp-kit';

import { normalizeAddress, shortAddress } from './lib/address';
import { type InferrailClient } from './lib/inferrailClient';
import { sha256Hex } from './lib/hash';
import {
  MockInferrailClient,
  clearMockJobs,
  seedMockScenario,
  type MockScenario,
} from './lib/mockInferrailClient';
import { SuiInferrailClient } from './lib/suiInferrailClient';
import { type Job, type JobStatus } from './types';

type ClientMode = 'mock' | 'sui';
type ActorRole = 'requester' | 'worker';
type SuiNetwork = 'testnet' | 'devnet' | 'mainnet';

type AppEnv = Record<string, string | undefined>;

const APP_ENV: AppEnv = (import.meta as ImportMeta & { env?: AppEnv }).env ?? {};
const DEFAULT_REQUESTER_ADDRESS = '0xA11CE';
const DEFAULT_WORKER_ADDRESS = '0xB0B';

const statusLabel: Record<JobStatus, string> = {
  Created: 'Created',
  Accepted: 'Accepted',
  Submitted: 'Submitted',
  Settled: 'Settled',
  Refunded: 'Refunded',
};

function normalizeNetwork(value: string | undefined): SuiNetwork {
  if (value === 'devnet' || value === 'mainnet' || value === 'testnet') {
    return value;
  }
  return 'testnet';
}

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleString();
}

function timeLeft(deadlineMs: number): string {
  const diff = deadlineMs - Date.now();
  if (diff <= 0) {
    return 'Expired';
  }
  const mins = Math.floor(diff / 60000);
  if (mins < 60) {
    return `${mins}m left`;
  }
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  return `${hours}h ${rest}m left`;
}

function isExpired(job: Job): boolean {
  return Date.now() > job.deadlineMs;
}

function statusClass(status: JobStatus): string {
  switch (status) {
    case 'Created':
      return 'chip chip-created';
    case 'Accepted':
      return 'chip chip-accepted';
    case 'Submitted':
      return 'chip chip-submitted';
    case 'Settled':
      return 'chip chip-settled';
    case 'Refunded':
      return 'chip chip-refunded';
    default:
      return 'chip';
  }
}

export default function App(): JSX.Element {
  const hasPackageId = (APP_ENV.VITE_INFERRAIL_PACKAGE_ID ?? '').trim().length > 2;
  const [mode, setMode] = useState<ClientMode>(hasPackageId ? 'sui' : 'mock');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const [requesterAddress, setRequesterAddress] = useState(DEFAULT_REQUESTER_ADDRESS);
  const [workerAddress, setWorkerAddress] = useState(DEFAULT_WORKER_ADDRESS);
  const [actorRole, setActorRole] = useState<ActorRole>('requester');

  const [description, setDescription] = useState('Run llama3.1 inference on customer prompts');
  const [budget, setBudget] = useState(25);
  const [deadlineMinutes, setDeadlineMinutes] = useState(30);

  const [resultUri, setResultUri] = useState('ipfs://result.json');
  const [resultBody, setResultBody] = useState('{"output":"answer"}');
  const [resultHash, setResultHash] = useState('');

  const [suiNetwork, setSuiNetwork] = useState<SuiNetwork>(
    normalizeNetwork(APP_ENV.VITE_SUI_NETWORK),
  );
  const [suiCoinType, setSuiCoinType] = useState(
    APP_ENV.VITE_INFERRAIL_COIN_TYPE ?? '0x2::sui::SUI',
  );
  const [suiPaymentCoinObjectId, setSuiPaymentCoinObjectId] = useState(
    APP_ENV.VITE_INFERRAIL_PAYMENT_COIN_OBJECT_ID ?? '',
  );

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { client: suiClient, network: activeSuiNetwork, selectNetwork } = useSuiClientContext();
  const currentAccount = useCurrentAccount();
  const { currentWallet, connectionStatus } = useCurrentWallet();
  const { mutateAsync: disconnectWallet, isPending: disconnectingWallet } = useDisconnectWallet();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const walletAddress = currentAccount ? normalizeAddress(currentAccount.address) : null;
  const walletProvider = currentWallet?.name ?? 'none';

  const signerAddressRef = useRef<string | null>(walletAddress);
  const signAndExecuteRef = useRef(signAndExecuteTransaction);

  useEffect(() => {
    signerAddressRef.current = walletAddress;
  }, [walletAddress]);

  useEffect(() => {
    signAndExecuteRef.current = signAndExecuteTransaction;
  }, [signAndExecuteTransaction]);

  useEffect(() => {
    if (!walletAddress) {
      return;
    }

    const requesterIsPlaceholder =
      requesterAddress.trim() === '' ||
      normalizeAddress(requesterAddress) === normalizeAddress(DEFAULT_REQUESTER_ADDRESS);
    const workerIsPlaceholder =
      workerAddress.trim() === '' ||
      normalizeAddress(workerAddress) === normalizeAddress(DEFAULT_WORKER_ADDRESS);

    if (requesterIsPlaceholder) {
      setRequesterAddress(walletAddress);
    }
    if (workerIsPlaceholder) {
      setWorkerAddress(walletAddress);
    }
  }, [requesterAddress, walletAddress, workerAddress]);

  const signerProvider = useCallback(() => {
    const address = signerAddressRef.current;
    if (!address) {
      return null;
    }
    return {
      address,
      signAndExecuteTransaction: async (txBytes: string) =>
        signAndExecuteRef.current({ transaction: txBytes }),
    };
  }, []);

  const autoSelectPaymentCoin = useCallback(
    async (silent: boolean): Promise<string | null> => {
      if (mode !== 'sui' || !walletAddress) {
        return null;
      }

      const coins = await suiClient.getCoins({
        owner: walletAddress,
        coinType: suiCoinType,
        limit: 1,
      });
      const coinObjectId = coins.data[0]?.coinObjectId ?? null;
      if (!coinObjectId) {
        if (!silent) {
          setError(
            `No ${suiCoinType} coin object found for wallet ${shortAddress(walletAddress)}. Request faucet funds first.`,
          );
        }
        return null;
      }

      setSuiPaymentCoinObjectId((prev) => (prev.trim() === coinObjectId ? prev : coinObjectId));
      if (!silent) {
        setNotice(`Auto-selected payment coin: ${shortAddress(coinObjectId)}`);
      }
      return coinObjectId;
    },
    [mode, suiClient, suiCoinType, walletAddress],
  );

  const client: InferrailClient = useMemo(() => {
    if (mode === 'sui') {
      return new SuiInferrailClient({
        network: suiNetwork,
        defaultCoinType: suiCoinType,
        defaultPaymentCoinObjectId: suiPaymentCoinObjectId,
        signerProvider,
      });
    }
    return new MockInferrailClient();
  }, [mode, signerProvider, suiCoinType, suiNetwork, suiPaymentCoinObjectId]);

  const selectedJob = useMemo(
    () => jobs.find((item) => item.id === selectedJobId) ?? null,
    [jobs, selectedJobId],
  );

  const actorAddress = actorRole === 'requester' ? requesterAddress.trim() : workerAddress.trim();

  async function refreshJobs(): Promise<void> {
    const nextJobs = await client.listJobs();
    setJobs(nextJobs);
    if (!selectedJobId && nextJobs.length > 0) {
      setSelectedJobId(nextJobs[0].id);
      return;
    }
    if (selectedJobId && !nextJobs.some((job) => job.id === selectedJobId)) {
      setSelectedJobId(nextJobs[0]?.id ?? null);
    }
  }

  async function withAction(action: () => Promise<void>, successNotice: string): Promise<void> {
    setError(null);
    setNotice(null);
    setPending(true);
    try {
      await action();
      await refreshJobs();
      setNotice(successNotice);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  async function onCreateJob(): Promise<void> {
    const cleanRequester = requesterAddress.trim();
    if (!cleanRequester) {
      setError('Requester address cannot be empty');
      return;
    }
    let paymentCoinObjectId: string | undefined;
    if (mode === 'sui') {
      const resolvedPaymentCoinObjectId =
        (await autoSelectPaymentCoin(true)) ?? suiPaymentCoinObjectId.trim();
      paymentCoinObjectId = resolvedPaymentCoinObjectId || undefined;
      if (!paymentCoinObjectId) {
        setError(
          `No ${suiCoinType} coin object available for current wallet. Request faucet funds first.`,
        );
        return;
      }
    }

    const deadlineMs = Date.now() + deadlineMinutes * 60_000;
    await withAction(async () => {
      const created = await client.createJob({
        description,
        budget,
        deadlineMs,
        requester: cleanRequester,
        coinType: mode === 'sui' ? suiCoinType : undefined,
        paymentCoinObjectId,
      });
      setSelectedJobId(created.id);
    }, 'Job created and escrow locked');
  }

  async function onAccept(job: Job): Promise<void> {
    await withAction(async () => {
      await client.acceptJob({
        jobId: job.id,
        worker: workerAddress.trim(),
        coinType: mode === 'sui' ? suiCoinType : undefined,
      });
    }, 'Job accepted by worker');
  }

  async function onGenerateHash(): Promise<void> {
    const hash = await sha256Hex(resultBody);
    setResultHash(hash);
  }

  async function onSubmit(job: Job): Promise<void> {
    if (!resultHash) {
      setError('Generate a result hash before submit');
      return;
    }
    await withAction(async () => {
      await client.submitResult({
        jobId: job.id,
        worker: workerAddress.trim(),
        resultUri,
        resultHash,
        coinType: mode === 'sui' ? suiCoinType : undefined,
      });
    }, 'Result proof submitted');
  }

  async function onSettle(job: Job): Promise<void> {
    await withAction(async () => {
      await client.settleJob({
        jobId: job.id,
        requester: requesterAddress.trim(),
        coinType: mode === 'sui' ? suiCoinType : undefined,
      });
    }, 'Job settled, payout released');
  }

  async function onRefund(job: Job): Promise<void> {
    await withAction(async () => {
      await client.refundJob({
        jobId: job.id,
        requester: requesterAddress.trim(),
        coinType: mode === 'sui' ? suiCoinType : undefined,
      });
    }, 'Refund executed');
  }

  async function onResetDemo(): Promise<void> {
    clearMockJobs();
    setSelectedJobId(null);
    await refreshJobs();
    setNotice('Mock dataset cleared');
  }

  async function onSeedDemoScenario(scenario: MockScenario): Promise<void> {
    if (mode !== 'mock') {
      return;
    }

    clearMockJobs();
    seedMockScenario(scenario);
    setSelectedJobId(null);
    await refreshJobs();
    if (scenario === 'happy_path') {
      setNotice('Seeded scenario A: successful settlement');
      return;
    }
    setNotice('Seeded scenario B: timeout refund candidate');
  }

  async function onDisconnectWallet(): Promise<void> {
    setError(null);
    setNotice(null);
    try {
      await disconnectWallet();
      setNotice('Wallet disconnected.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function onUseWalletForActiveRole(): void {
    if (!walletAddress) {
      return;
    }
    if (actorRole === 'requester') {
      setRequesterAddress(walletAddress);
    } else {
      setWorkerAddress(walletAddress);
    }
    setNotice(`Synced ${actorRole} address from wallet.`);
  }

  useEffect(() => {
    refreshJobs().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : String(err));
    });
  }, [client]);

  useEffect(() => {
    const nextNetwork = normalizeNetwork(activeSuiNetwork);
    if (nextNetwork !== suiNetwork) {
      setSuiNetwork(nextNetwork);
    }
  }, [activeSuiNetwork, suiNetwork]);

  useEffect(() => {
    if (mode === 'sui' && activeSuiNetwork !== suiNetwork) {
      selectNetwork(suiNetwork);
    }
  }, [activeSuiNetwork, mode, selectNetwork, suiNetwork]);

  useEffect(() => {
    if (mode !== 'sui' || !walletAddress) {
      return;
    }
    autoSelectPaymentCoin(true).catch(() => {
      // ignore background auto-select errors
    });
  }, [autoSelectPaymentCoin, mode, walletAddress, activeSuiNetwork, suiCoinType]);

  const canAccept =
    selectedJob !== null &&
    selectedJob.status === 'Created' &&
    !isExpired(selectedJob) &&
    actorRole === 'worker' &&
    selectedJob.requester !== workerAddress.trim();

  const canSubmit =
    selectedJob !== null &&
    selectedJob.status === 'Accepted' &&
    !isExpired(selectedJob) &&
    actorRole === 'worker' &&
    selectedJob.worker === workerAddress.trim();

  const canSettle =
    selectedJob !== null &&
    selectedJob.status === 'Submitted' &&
    actorRole === 'requester' &&
    selectedJob.requester === requesterAddress.trim();

  const canRefund =
    selectedJob !== null &&
    (selectedJob.status === 'Created' ||
      selectedJob.status === 'Accepted' ||
      selectedJob.status === 'Submitted') &&
    isExpired(selectedJob) &&
    actorRole === 'requester' &&
    selectedJob.requester === requesterAddress.trim();

  const isWalletRequired = mode === 'sui';
  const walletConnected = Boolean(walletAddress);
  const signerMismatch =
    isWalletRequired &&
    walletConnected &&
    actorAddress !== '' &&
    normalizeAddress(actorAddress) !== normalizeAddress(walletAddress ?? '');

  return (
    <div className="page">
      <header className="hero panel slide-up">
        <p className="kicker">Hackathon MVP</p>
        <h1>InferRail</h1>
        <p className="subhead">
          From trust-based outsourcing to rule-based delivery settlement.
        </p>
        <div className="hero-row">
          <span className={`chip ${mode === 'mock' ? 'chip-created' : 'chip-submitted'}`}>
            {mode.toUpperCase()} MODE
          </span>
          <button className="ghost" onClick={() => refreshJobs()} disabled={pending}>
            Refresh
          </button>
          <button className="ghost" onClick={() => onResetDemo()} disabled={pending || mode !== 'mock'}>
            Reset Mock Data
          </button>
          <button
            className="ghost"
            onClick={() => onSeedDemoScenario('happy_path')}
            disabled={pending || mode !== 'mock'}
          >
            Seed Scenario A
          </button>
          <button
            className="ghost"
            onClick={() => onSeedDemoScenario('timeout_refund')}
            disabled={pending || mode !== 'mock'}
          >
            Seed Scenario B
          </button>
        </div>
        <div className="wallet-bar">
          <div className="wallet-meta">
            <strong>Wallet</strong>
            <span>{walletConnected ? shortAddress(walletAddress ?? '') : 'Not connected'}</span>
            <small className="muted">Provider: {walletProvider}</small>
            <small className="muted">Status: {connectionStatus}</small>
          </div>
          <div className="action-row">
            <ConnectButton
              className="ghost"
              connectText="Connect Wallet"
              disabled={pending || mode !== 'sui'}
            />
            <button
              className="ghost"
              onClick={() => onDisconnectWallet()}
              disabled={pending || disconnectingWallet || !walletConnected || mode !== 'sui'}
            >
              Disconnect
            </button>
            <button
              className="ghost"
              onClick={() => onUseWalletForActiveRole()}
              disabled={pending || !walletConnected}
            >
              Use As {actorRole}
            </button>
          </div>
        </div>
      </header>

      <main className="layout">
        <section className="panel stack slide-up delay-1">
          <h2>Operator Console</h2>
          <div className="field-grid">
            <label>
              <span>Client</span>
              <select value={mode} onChange={(e) => setMode(e.target.value as ClientMode)}>
                <option value="mock">Mock (demo-ready)</option>
                <option value="sui">Sui (on-chain read/write)</option>
              </select>
            </label>
            <label>
              <span>Active Role</span>
              <select value={actorRole} onChange={(e) => setActorRole(e.target.value as ActorRole)}>
                <option value="requester">Requester</option>
                <option value="worker">Worker</option>
              </select>
            </label>
            <label>
              <span>Requester Address</span>
              <input
                value={requesterAddress}
                onChange={(e) => setRequesterAddress(e.target.value)}
                placeholder="0x..."
              />
            </label>
            <label>
              <span>Worker Address</span>
              <input
                value={workerAddress}
                onChange={(e) => setWorkerAddress(e.target.value)}
                placeholder="0x..."
              />
            </label>
            {mode === 'sui' && (
              <label>
                <span>Sui Network</span>
                <select
                  value={suiNetwork}
                  onChange={(e) => {
                    const nextNetwork = e.target.value as SuiNetwork;
                    setSuiNetwork(nextNetwork);
                    selectNetwork(nextNetwork);
                  }}
                >
                  <option value="testnet">testnet</option>
                  <option value="devnet">devnet</option>
                  <option value="mainnet">mainnet</option>
                </select>
              </label>
            )}
            {mode === 'sui' && (
              <label>
                <span>Coin Type</span>
                <input
                  value={suiCoinType}
                  onChange={(e) => setSuiCoinType(e.target.value)}
                  placeholder="0x2::sui::SUI"
                />
              </label>
            )}
            {mode === 'sui' && (
              <label>
                <span>Payment Coin Object ID (create)</span>
                <input
                  value={suiPaymentCoinObjectId}
                  onChange={(e) => setSuiPaymentCoinObjectId(e.target.value)}
                  placeholder="0x..."
                />
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    setError(null);
                    setNotice(null);
                    autoSelectPaymentCoin(false).catch((err) => {
                      setError(err instanceof Error ? err.message : String(err));
                    });
                  }}
                  disabled={pending || !walletConnected}
                >
                  Auto Select Wallet Coin
                </button>
              </label>
            )}
          </div>
          <p className="muted">Current actor: {actorRole} ({actorAddress || 'n/a'})</p>

          <div className="divider" />

          <h3>Create Job</h3>
          <label>
            <span>Description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </label>
          <div className="field-grid">
            <label>
              <span>Budget</span>
              <input
                type="number"
                min={1}
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value || 0))}
              />
            </label>
            <label>
              <span>Deadline (minutes)</span>
              <input
                type="number"
                min={1}
                value={deadlineMinutes}
                onChange={(e) => setDeadlineMinutes(Number(e.target.value || 0))}
              />
            </label>
          </div>
          <button onClick={() => onCreateJob()} disabled={pending || (isWalletRequired && !walletConnected)}>
            Create + Lock Escrow
          </button>
          {mode === 'sui' && (
            <p className="muted">
              Sui mode uses dapp-kit wallet signing. The active wallet account must match requester or worker address.
              Budget is derived from the selected payment coin object and network is {suiNetwork}.
            </p>
          )}
          {mode === 'sui' && !walletConnected && (
            <p className="error">Connect wallet first, then sync requester/worker address.</p>
          )}
          {mode === 'sui' && walletConnected && signerMismatch && (
            <p className="error">
              Wallet signer does not match current {actorRole} address. Use "Use As {actorRole}" or edit address.
            </p>
          )}
        </section>

        <section className="panel stack slide-up delay-2">
          <h2>Jobs</h2>
          {jobs.length === 0 && <p className="muted">No jobs yet. Create one to start the flow.</p>}
          <div className="job-list">
            {jobs.map((job) => (
              <button
                key={job.id}
                className={`job-card ${selectedJobId === job.id ? 'selected' : ''}`}
                onClick={() => setSelectedJobId(job.id)}
              >
                <div className="job-top">
                  <strong>{job.description.slice(0, 42)}</strong>
                  <span className={statusClass(job.status)}>{statusLabel[job.status]}</span>
                </div>
                <div className="job-meta">
                  <span>Budget: {job.budget}</span>
                  <span>{timeLeft(job.deadlineMs)}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="panel stack slide-up delay-3">
          <h2>Job Detail</h2>
          {!selectedJob && <p className="muted">Select a job from the list.</p>}

          {selectedJob && (
            <>
              <div className="detail-row">
                <span className={statusClass(selectedJob.status)}>{statusLabel[selectedJob.status]}</span>
                <span className="muted">Deadline: {fmtTime(selectedJob.deadlineMs)}</span>
              </div>

              <p>{selectedJob.description}</p>

              <div className="detail-grid">
                <p><strong>Requester:</strong> {selectedJob.requester}</p>
                <p><strong>Worker:</strong> {selectedJob.worker ?? 'Unassigned'}</p>
                <p><strong>Budget:</strong> {selectedJob.budget}</p>
                <p><strong>Created:</strong> {fmtTime(selectedJob.createdAtMs)}</p>
                <p><strong>Updated:</strong> {fmtTime(selectedJob.updatedAtMs)}</p>
                <p><strong>Result URI:</strong> {selectedJob.resultUri ?? 'n/a'}</p>
                <p><strong>Result Hash:</strong> {selectedJob.resultHash ?? 'n/a'}</p>
              </div>

              <div className="divider" />

              <h3>Actions</h3>
              <div className="action-row">
                <button
                  disabled={!canAccept || pending || (isWalletRequired && !walletConnected)}
                  onClick={() => onAccept(selectedJob)}
                >
                  Accept Job
                </button>
                <button
                  disabled={!canSettle || pending || (isWalletRequired && !walletConnected)}
                  onClick={() => onSettle(selectedJob)}
                >
                  Settle
                </button>
                <button
                  disabled={!canRefund || pending || (isWalletRequired && !walletConnected)}
                  onClick={() => onRefund(selectedJob)}
                >
                  Refund (Timeout)
                </button>
              </div>

              <div className="submit-box">
                <h4>Submit Result Proof</h4>
                <label>
                  <span>Result URI</span>
                  <input value={resultUri} onChange={(e) => setResultUri(e.target.value)} />
                </label>
                <label>
                  <span>Result Payload (for hashing)</span>
                  <textarea value={resultBody} onChange={(e) => setResultBody(e.target.value)} rows={3} />
                </label>
                <div className="hash-row">
                  <input value={resultHash} onChange={(e) => setResultHash(e.target.value)} placeholder="sha256..." />
                  <button onClick={() => onGenerateHash()} disabled={pending} className="ghost">
                    Generate Hash
                  </button>
                  <button
                    disabled={!canSubmit || pending || (isWalletRequired && !walletConnected)}
                    onClick={() => onSubmit(selectedJob)}
                  >
                    Submit
                  </button>
                </div>
              </div>

              <div className="divider" />

              <h3>Timeline</h3>
              <ol className="timeline">
                {selectedJob.timeline.map((event) => (
                  <li key={event.id}>
                    <div>
                      <strong>{event.type}</strong>
                      <p>{event.note}</p>
                    </div>
                    <div className="timeline-meta">
                      <span>{event.actor}</span>
                      <time>{fmtTime(event.atMs)}</time>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      </main>

      <footer className="panel footnote">
        {error && <p className="error">{error}</p>}
        {notice && <p className="notice">{notice}</p>}
      </footer>
    </div>
  );
}
