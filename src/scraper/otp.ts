/** Rejected error when the OTP wait exceeds its configured timeout. */
export class OtpTimeoutError extends Error {
  constructor() {
    super('Timed out waiting for OTP code');
    this.name = 'OtpTimeoutError';
  }
}

/** Rejected error when the OTP wait is cancelled (e.g. job deleted). */
export class OtpCancelledError extends Error {
  constructor() {
    super('OTP wait cancelled');
    this.name = 'OtpCancelledError';
  }
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (v: T) => void;
  reject: (e: Error) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (v: T) => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export interface OtpBridgeOptions {
  /** Milliseconds to wait for the code before rejecting with OtpTimeoutError. */
  timeoutMs: number;
  /** Called once, the first time the library asks for the OTP code. */
  onWaiting?: () => void;
}

/**
 * Bridges the scraper library's synchronous-looking `otpCodeRetriever` — a
 * function returning a Promise<string> — to an out-of-band HTTP submission. The
 * runner passes {@link retriever} to the OneZero scraper; when the library calls
 * it, the job transitions to `waiting_for_otp` and this promise stays pending
 * until {@link submit} is called, the {@link cancel} is invoked, or the timeout
 * elapses.
 */
export class OtpBridge {
  private readonly deferred = createDeferred<string>();
  private waiting = false;
  private settled = false;
  private timer?: ReturnType<typeof setTimeout>;
  private readonly options: OtpBridgeOptions;

  constructor(options: OtpBridgeOptions) {
    this.options = options;
  }

  /** Passed to the scraper as its `otpCodeRetriever`. */
  readonly retriever = (): Promise<string> => {
    if (!this.waiting && !this.settled) {
      this.waiting = true;
      this.timer = setTimeout(() => {
        if (!this.settled) {
          this.finish();
          this.deferred.reject(new OtpTimeoutError());
        }
      }, this.options.timeoutMs);
      this.options.onWaiting?.();
    }
    return this.deferred.promise;
  };

  /** Delivers the OTP code submitted by the client. */
  submit(code: string): void {
    if (this.settled) return;
    this.finish();
    this.deferred.resolve(code);
  }

  /** Aborts the wait (e.g. the job was cancelled). */
  cancel(): void {
    if (this.settled) return;
    this.finish();
    this.deferred.reject(new OtpCancelledError());
  }

  get isWaiting(): boolean {
    return this.waiting && !this.settled;
  }

  get isSettled(): boolean {
    return this.settled;
  }

  private finish(): void {
    this.settled = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }
}
