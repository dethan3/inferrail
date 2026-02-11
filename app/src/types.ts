export type JobStatus = 'Created' | 'Accepted' | 'Submitted' | 'Settled' | 'Refunded';

export type TimelineType =
  | 'JobCreated'
  | 'JobAccepted'
  | 'ResultSubmitted'
  | 'JobSettled'
  | 'JobRefunded';

export interface TimelineEvent {
  id: string;
  type: TimelineType;
  actor: string;
  atMs: number;
  note: string;
}

export interface Job {
  id: string;
  description: string;
  budget: number;
  deadlineMs: number;
  requester: string;
  worker: string | null;
  status: JobStatus;
  resultUri: string | null;
  resultHash: string | null;
  createdAtMs: number;
  updatedAtMs: number;
  timeline: TimelineEvent[];
}

export interface CreateJobInput {
  description: string;
  budget: number;
  deadlineMs: number;
  requester: string;
  coinType?: string;
  paymentCoinObjectId?: string;
  gasBudget?: number;
}

export interface AcceptJobInput {
  jobId: string;
  worker: string;
  coinType?: string;
  gasBudget?: number;
}

export interface SubmitResultInput {
  jobId: string;
  worker: string;
  resultUri: string;
  resultHash: string;
  coinType?: string;
  gasBudget?: number;
}

export interface SettleJobInput {
  jobId: string;
  requester: string;
  coinType?: string;
  gasBudget?: number;
}

export interface RefundJobInput {
  jobId: string;
  requester: string;
  coinType?: string;
  gasBudget?: number;
}
