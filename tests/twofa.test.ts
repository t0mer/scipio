import { describe, it, expect, vi } from 'vitest';
import type { BrowserContext } from 'puppeteer-core';
import { TwoFactorManager, TwoFactorSessionError } from '../src/scraper/twofa.js';
import type { ScraperFactory } from '../src/scraper/runner.js';

interface FakeScraper {
  triggerTwoFactorAuth: ReturnType<typeof vi.fn>;
  getLongTermTwoFactorToken: ReturnType<typeof vi.fn>;
}

function setup(scraperBehaviour: Partial<FakeScraper> = {}) {
  const scraper: FakeScraper = {
    triggerTwoFactorAuth: vi.fn(async () => ({ success: true })),
    getLongTermTwoFactorToken: vi.fn(async () => ({
      success: true,
      longTermTwoFactorAuthToken: 'LTT',
    })),
    ...scraperBehaviour,
  };
  const release = vi.fn(async () => undefined);
  const createScraper = vi.fn(() => scraper) as unknown as ScraperFactory;
  const acquireContext = vi.fn(async () => ({ context: {} as BrowserContext, release }));
  const manager = new TwoFactorManager({ createScraper, acquireContext }, { sessionTtlMs: 10_000 });
  return { manager, scraper, release, acquireContext };
}

describe('TwoFactorManager', () => {
  it('completes the trigger -> long-term-token handshake and closes the session', async () => {
    const { manager, scraper, release } = setup();
    const triggered = await manager.trigger('oneZero', '972500000000');
    expect(triggered).toEqual({ success: true });
    expect(scraper.triggerTwoFactorAuth).toHaveBeenCalledWith('972500000000');

    const result = await manager.getLongTermToken('oneZero', '123456');
    expect(result).toEqual({ success: true, longTermTwoFactorAuthToken: 'LTT' });
    expect(scraper.getLongTermTwoFactorToken).toHaveBeenCalledWith('123456');
    expect(release).toHaveBeenCalled();
  });

  it('releases the context and stores no session when trigger fails', async () => {
    const { manager, release } = setup({
      triggerTwoFactorAuth: vi.fn(async () => ({ success: false, errorMessage: 'nope' })),
    });
    const triggered = await manager.trigger('oneZero', '972500000000');
    expect(triggered).toEqual({ success: false, errorMessage: 'nope' });
    expect(release).toHaveBeenCalledOnce();
    await expect(manager.getLongTermToken('oneZero', '1')).rejects.toBeInstanceOf(
      TwoFactorSessionError,
    );
  });

  it('throws when no session exists for long-term-token', async () => {
    const { manager } = setup();
    await expect(manager.getLongTermToken('oneZero', '1')).rejects.toBeInstanceOf(
      TwoFactorSessionError,
    );
  });

  it('discards a prior session when triggered again for the same company', async () => {
    const { manager, release } = setup();
    await manager.trigger('oneZero', '111');
    await manager.trigger('oneZero', '222');
    // first session's context should have been released during the second trigger
    expect(release).toHaveBeenCalled();
  });

  it('discards the session even when long-term-token returns an error', async () => {
    const { manager, release } = setup({
      getLongTermTwoFactorToken: vi.fn(async () => ({ success: false, errorMessage: 'bad otp' })),
    });
    await manager.trigger('oneZero', '111');
    const result = await manager.getLongTermToken('oneZero', 'wrong');
    expect(result).toEqual({ success: false, errorMessage: 'bad otp' });
    expect(release).toHaveBeenCalled();
    await expect(manager.getLongTermToken('oneZero', 'wrong')).rejects.toBeInstanceOf(
      TwoFactorSessionError,
    );
  });
});
