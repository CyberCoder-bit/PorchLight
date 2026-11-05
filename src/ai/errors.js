// One error type for every AI failure, with a short reason people can read.
export class LiveSparkError extends Error {
  // retry: true when another model might still answer (busy, timeout, bad output).
  constructor(reason, { cause, retry = false } = {}) {
    super(reason);
    this.reason = reason;
    this.cause = cause;
    this.retry = retry;
  }
}
