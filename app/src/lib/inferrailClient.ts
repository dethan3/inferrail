import {
  type AcceptJobInput,
  type CreateJobInput,
  type Job,
  type RefundJobInput,
  type SettleJobInput,
  type SubmitResultInput,
} from '../types';

export interface InferrailClient {
  listJobs(): Promise<Job[]>;
  createJob(input: CreateJobInput): Promise<Job>;
  acceptJob(input: AcceptJobInput): Promise<Job>;
  submitResult(input: SubmitResultInput): Promise<Job>;
  settleJob(input: SettleJobInput): Promise<Job>;
  refundJob(input: RefundJobInput): Promise<Job>;
}
