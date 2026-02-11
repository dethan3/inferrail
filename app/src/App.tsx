import { useEffect, useMemo, useState } from 'react';

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

const statusLabel: Record<JobStatus, string> = {
  Created: 'Created',
  Accepted: 'Accepted',
  Submitted: 'Submitted',
  Settled: 'Settled',
  Refunded: 'Refunded',
};

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
  const [mode, setMode] = useState<ClientMode>('mock');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const [requesterAddress, setRequesterAddress] = useState('0xA11CE');
  const [workerAddress, setWorkerAddress] = useState('0xB0B');
  const [actorRole, setActorRole] = useState<ActorRole>('requester');

  const [description, setDescription] = useState('Run llama3.1 inference on customer prompts');
  const [budget, setBudget] = useState(25);
  const [deadlineMinutes, setDeadlineMinutes] = useState(30);

  const [resultUri, setResultUri] = useState('ipfs://result.json');
  const [resultBody, setResultBody] = useState('{"output":"answer"}');
  const [resultHash, setResultHash] = useState('');

  const [suiNetwork, setSuiNetwork] = useState<SuiNetwork>('testnet');
  const [suiCoinType, setSuiCoinType] = useState('0x2::sui::SUI');
  const [suiPaymentCoinObjectId, setSuiPaymentCoinObjectId] = useState('');

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const client: InferrailClient = useMemo(() => {
    if (mode === 'sui') {
      return new SuiInferrailClient({
        network: suiNetwork,
        defaultCoinType: suiCoinType,
        defaultPaymentCoinObjectId: suiPaymentCoinObjectId,
      });
    }
    return new MockInferrailClient();
  }, [mode, suiCoinType, suiNetwork, suiPaymentCoinObjectId]);

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
    const deadlineMs = Date.now() + deadlineMinutes * 60_000;
    await withAction(async () => {
      const created = await client.createJob({
        description,
        budget,
        deadlineMs,
        requester: cleanRequester,
        coinType: mode === 'sui' ? suiCoinType : undefined,
        paymentCoinObjectId: mode === 'sui' ? suiPaymentCoinObjectId.trim() : undefined,
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

  useEffect(() => {
    refreshJobs().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : String(err));
    });
  }, [client]);

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
                  onChange={(e) => setSuiNetwork(e.target.value as SuiNetwork)}
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
          <button onClick={() => onCreateJob()} disabled={pending}>
            Create + Lock Escrow
          </button>
          {mode === 'sui' && (
            <p className="muted">
              Sui mode uses injected wallet signing. The active wallet account must match requester or worker address.
              Budget is derived from the selected payment coin object and network is {suiNetwork}.
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
                <button disabled={!canAccept || pending} onClick={() => onAccept(selectedJob)}>
                  Accept Job
                </button>
                <button disabled={!canSettle || pending} onClick={() => onSettle(selectedJob)}>
                  Settle
                </button>
                <button disabled={!canRefund || pending} onClick={() => onRefund(selectedJob)}>
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
                    disabled={!canSubmit || pending}
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
