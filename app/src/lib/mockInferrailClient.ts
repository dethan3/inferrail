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

const STORAGE_KEY = 'inferrail.jobs.v1';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function nowMs(): number {
  return Date.now();
}

function loadJobs(): Job[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as Job[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveJobs(jobs: Job[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
}

function findJobOrThrow(jobs: Job[], jobId: string): Job {
  const job = jobs.find((item) => item.id === jobId);
  if (!job) {
    throw new Error('Job not found');
  }
  return job;
}

function pushEvent(job: Job, event: Omit<TimelineEvent, 'id'>): void {
  job.timeline.push({
    id: makeId(),
    ...event,
  });
}

function isExpired(job: Job, atMs: number): boolean {
  return atMs > job.deadlineMs;
}

export class MockInferrailClient implements InferrailClient {
  async listJobs(): Promise<Job[]> {
    const jobs = loadJobs().sort((a, b) => b.createdAtMs - a.createdAtMs);
    return clone(jobs);
  }

  async createJob(input: CreateJobInput): Promise<Job> {
    if (!input.description.trim()) {
      throw new Error('Description cannot be empty');
    }
    if (input.budget <= 0) {
      throw new Error('Budget must be greater than 0');
    }

    const now = nowMs();
    if (input.deadlineMs <= now) {
      throw new Error('Deadline must be in the future');
    }

    const newJob: Job = {
      id: makeId(),
      description: input.description.trim(),
      budget: input.budget,
      deadlineMs: input.deadlineMs,
      requester: input.requester,
      worker: null,
      status: 'Created',
      resultUri: null,
      resultHash: null,
      createdAtMs: now,
      updatedAtMs: now,
      timeline: [],
    };

    pushEvent(newJob, {
      type: 'JobCreated',
      actor: input.requester,
      atMs: now,
      note: `Escrow locked: ${input.budget}`,
    });

    const jobs = loadJobs();
    jobs.push(newJob);
    saveJobs(jobs);
    return clone(newJob);
  }

  async acceptJob(input: AcceptJobInput): Promise<Job> {
    const jobs = loadJobs();
    const job = findJobOrThrow(jobs, input.jobId);
    const now = nowMs();

    if (job.status !== 'Created') {
      throw new Error('Job is not open for acceptance');
    }
    if (job.requester === input.worker) {
      throw new Error('Requester cannot accept own job');
    }
    if (isExpired(job, now)) {
      throw new Error('Job already expired');
    }

    job.worker = input.worker;
    job.status = 'Accepted';
    job.updatedAtMs = now;
    pushEvent(job, {
      type: 'JobAccepted',
      actor: input.worker,
      atMs: now,
      note: 'Worker accepted job',
    });

    saveJobs(jobs);
    return clone(job);
  }

  async submitResult(input: SubmitResultInput): Promise<Job> {
    const jobs = loadJobs();
    const job = findJobOrThrow(jobs, input.jobId);
    const now = nowMs();

    if (job.status !== 'Accepted') {
      throw new Error('Only accepted jobs can receive result submission');
    }
    if (job.worker !== input.worker) {
      throw new Error('Only assigned worker can submit result');
    }
    if (isExpired(job, now)) {
      throw new Error('Job already expired');
    }
    if (!input.resultUri.trim()) {
      throw new Error('Result URI cannot be empty');
    }

    job.resultUri = input.resultUri.trim();
    job.resultHash = input.resultHash;
    job.status = 'Submitted';
    job.updatedAtMs = now;
    pushEvent(job, {
      type: 'ResultSubmitted',
      actor: input.worker,
      atMs: now,
      note: `Result hash: ${input.resultHash.slice(0, 10)}...`,
    });

    saveJobs(jobs);
    return clone(job);
  }

  async settleJob(input: SettleJobInput): Promise<Job> {
    const jobs = loadJobs();
    const job = findJobOrThrow(jobs, input.jobId);
    const now = nowMs();

    if (job.status !== 'Submitted') {
      throw new Error('Only submitted jobs can be settled');
    }
    if (job.requester !== input.requester) {
      throw new Error('Only requester can settle the job');
    }

    job.status = 'Settled';
    job.updatedAtMs = now;
    pushEvent(job, {
      type: 'JobSettled',
      actor: input.requester,
      atMs: now,
      note: `Released ${job.budget} to worker`,
    });

    saveJobs(jobs);
    return clone(job);
  }

  async refundJob(input: RefundJobInput): Promise<Job> {
    const jobs = loadJobs();
    const job = findJobOrThrow(jobs, input.jobId);
    const now = nowMs();

    if (job.requester !== input.requester) {
      throw new Error('Only requester can refund the job');
    }
    if (job.status === 'Settled' || job.status === 'Refunded') {
      throw new Error('Job is already finalized');
    }
    if (!isExpired(job, now)) {
      throw new Error('Job is not expired yet');
    }

    job.status = 'Refunded';
    job.updatedAtMs = now;
    pushEvent(job, {
      type: 'JobRefunded',
      actor: input.requester,
      atMs: now,
      note: `Refunded ${job.budget} back to requester`,
    });

    saveJobs(jobs);
    return clone(job);
  }
}

export function clearMockJobs(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export type MockScenario = 'happy_path' | 'timeout_refund';

function makeTimelineEvent(
  type: TimelineEvent['type'],
  actor: string,
  atMs: number,
  note: string,
): TimelineEvent {
  return {
    id: makeId(),
    type,
    actor,
    atMs,
    note,
  };
}

export function seedMockScenario(scenario: MockScenario): void {
  const requester = '0xA11CE';
  const worker = '0xB0B';
  const now = nowMs();

  if (scenario === 'happy_path') {
    const createdAtMs = now - 20 * 60_000;
    const acceptedAtMs = createdAtMs + 60_000;
    const submittedAtMs = acceptedAtMs + 2 * 60_000;
    const settledAtMs = submittedAtMs + 90_000;

    const job: Job = {
      id: makeId(),
      description: 'Seeded scenario: settled inference delivery',
      budget: 25,
      deadlineMs: now + 10 * 60_000,
      requester,
      worker,
      status: 'Settled',
      resultUri: 'ipfs://seeded-happy.json',
      resultHash: 'd11f0cafe1234seed',
      createdAtMs,
      updatedAtMs: settledAtMs,
      timeline: [
        makeTimelineEvent('JobCreated', requester, createdAtMs, 'Escrow locked: 25'),
        makeTimelineEvent('JobAccepted', worker, acceptedAtMs, 'Worker accepted job'),
        makeTimelineEvent('ResultSubmitted', worker, submittedAtMs, 'Result hash: d11f0cafe1...'),
        makeTimelineEvent('JobSettled', requester, settledAtMs, 'Released 25 to worker'),
      ],
    };

    saveJobs([job]);
    return;
  }

  const createdAtMs = now - 30 * 60_000;
  const acceptedAtMs = createdAtMs + 2 * 60_000;
  const submittedAtMs = acceptedAtMs + 3 * 60_000;

  const timeoutJob: Job = {
    id: makeId(),
    description: 'Seeded scenario: submission missed SLA and eligible for refund',
    budget: 40,
    deadlineMs: now - 5 * 60_000,
    requester,
    worker,
    status: 'Submitted',
    resultUri: 'ipfs://seeded-timeout.json',
    resultHash: 'fa11ba11deadbeef',
    createdAtMs,
    updatedAtMs: submittedAtMs,
    timeline: [
      makeTimelineEvent('JobCreated', requester, createdAtMs, 'Escrow locked: 40'),
      makeTimelineEvent('JobAccepted', worker, acceptedAtMs, 'Worker accepted job'),
      makeTimelineEvent('ResultSubmitted', worker, submittedAtMs, 'Result hash: fa11ba11de...'),
    ],
  };

  saveJobs([timeoutJob]);
}
