import type { AcquiredContext, ScraperFactory } from './runner.js';

/** Raised when a long-term-token request has no matching trigger session. */
export class TwoFactorSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TwoFactorSessionError';
  }
}

interface Session {
  scraper: {
    triggerTwoFactorAuth: (phoneNumber: string) => Promise<TriggerResult>;
    getLongTermTwoFactorToken: (otpCode: string) => Promise<LongTermResult>;
  };
  release: () => Promise<void>;
  timer: ReturnType<typeof setTimeout>;
}

type TriggerResult = { success: true } | { success: false; errorMessage: string };
type LongTermResult =
  { success: true; longTermTwoFactorAuthToken: string } | { success: false; errorMessage: string };

export interface TwoFactorManagerDeps {
  createScraper: ScraperFactory;
  acquireContext: () => Promise<AcquiredContext>;
}

export interface TwoFactorManagerOptions {
  /** How long a triggered session stays alive awaiting the OTP submission. */
  sessionTtlMs: number;
}

/**
 * Manages OneZero two-factor sessions across the two-call handshake
 * (`/2fa/trigger` then `/2fa/long-term-token`). Each session keeps its scraper
 * and browser context alive between the calls, keyed by companyId, with a TTL so
 * abandoned sessions are cleaned up.
 */
export class TwoFactorManager {
  private readonly sessions = new Map<string, Session>();

  constructor(
    private readonly deps: TwoFactorManagerDeps,
    private readonly options: TwoFactorManagerOptions,
  ) {}

  /** Triggers an OTP send and opens a session awaiting the code. */
  async trigger(companyId: string, phoneNumber: string): Promise<TriggerResult> {
    await this.discard(companyId);

    const { context, release } = await this.deps.acquireContext();
    let scraper: Session['scraper'];
    try {
      scraper = this.deps.createScraper({
        companyId,
        startDate: new Date(),
        browserContext: context,
        showBrowser: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any) as unknown as Session['scraper'];
      const result = await scraper.triggerTwoFactorAuth(phoneNumber);
      if (!result.success) {
        await release();
        return result;
      }
    } catch (err) {
      await release();
      throw err;
    }

    const timer = setTimeout(() => void this.discard(companyId), this.options.sessionTtlMs);
    // Do not keep the event loop alive for a cleanup timer.
    if (typeof timer.unref === 'function') timer.unref();
    this.sessions.set(companyId, { scraper, release, timer });
    return { success: true };
  }

  /** Exchanges an OTP code for a long-term token, closing the session after. */
  async getLongTermToken(companyId: string, otpCode: string): Promise<LongTermResult> {
    const session = this.sessions.get(companyId);
    if (!session) {
      throw new TwoFactorSessionError(
        'No active 2FA session for this company. Call POST /2fa/trigger first.',
      );
    }
    try {
      return await session.scraper.getLongTermTwoFactorToken(otpCode);
    } finally {
      await this.discard(companyId);
    }
  }

  private async discard(companyId: string): Promise<void> {
    const session = this.sessions.get(companyId);
    if (!session) return;
    clearTimeout(session.timer);
    this.sessions.delete(companyId);
    await session.release().catch(() => undefined);
  }

  /** Tears down all sessions (used on shutdown). */
  async closeAll(): Promise<void> {
    await Promise.all([...this.sessions.keys()].map((id) => this.discard(id)));
  }
}
