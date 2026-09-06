import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OtpBridge, OtpTimeoutError, OtpCancelledError } from '../src/scraper/otp.js';

describe('OtpBridge', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('resolves the retriever promise when a code is submitted', async () => {
    const bridge = new OtpBridge({ timeoutMs: 1000 });
    const p = bridge.retriever();
    expect(bridge.isWaiting).toBe(true);
    bridge.submit('123456');
    await expect(p).resolves.toBe('123456');
  });

  it('invokes the onWaiting hook exactly once when the retriever is first called', () => {
    const onWaiting = vi.fn();
    const bridge = new OtpBridge({ timeoutMs: 1000, onWaiting });
    void bridge.retriever();
    expect(onWaiting).toHaveBeenCalledTimes(1);
  });

  it('rejects with OtpTimeoutError after the timeout elapses', async () => {
    const bridge = new OtpBridge({ timeoutMs: 1000 });
    const p = bridge.retriever();
    const assertion = expect(p).rejects.toBeInstanceOf(OtpTimeoutError);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it('rejects with OtpCancelledError when cancelled', async () => {
    const bridge = new OtpBridge({ timeoutMs: 1000 });
    const p = bridge.retriever();
    bridge.cancel();
    await expect(p).rejects.toBeInstanceOf(OtpCancelledError);
  });

  it('submit before the retriever runs still delivers the code', async () => {
    const bridge = new OtpBridge({ timeoutMs: 1000 });
    bridge.submit('999');
    await expect(bridge.retriever()).resolves.toBe('999');
  });

  it('reports whether a submission is possible', () => {
    const bridge = new OtpBridge({ timeoutMs: 1000 });
    expect(bridge.isSettled).toBe(false);
    bridge.submit('1');
    expect(bridge.isSettled).toBe(true);
  });
});
