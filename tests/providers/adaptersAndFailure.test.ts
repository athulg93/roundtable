/**
 * Provider Adapter Contract and Failure Injection Tests (P1.2, P1.6, Section 8.2)
 */

import { describe, it, expect } from 'vitest';
import { MockProvider } from '../../packages/providers/mockProvider.ts';
import { normalizeError, sanitizeErrorMessage } from '../../packages/providers/errors.ts';

describe('MockProvider Contract & Streaming', () => {
  it('streams response chunks and returns final usage metadata', async () => {
    const mock = new MockProvider({ chunkDelayMs: 1 });
    const chunks: string[] = [];
    let finalUsageReceived = false;

    for await (const chunk of mock.generate({
      model: 'mock-fast',
      messages: [{ role: 'user', content: 'What is our primary design pattern?' }],
    })) {
      if (chunk.text) {
        chunks.push(chunk.text);
      }
      if (chunk.isFinal && chunk.usage) {
        finalUsageReceived = true;
        expect(chunk.usage.inputTokens).toBeGreaterThan(0);
        expect(chunk.usage.outputTokens).toBeGreaterThan(0);
        expect(chunk.usage.provider).toBe('Deterministic Mock Provider');
      }
    }

    expect(chunks.length).toBeGreaterThan(0);
    expect(finalUsageReceived).toBe(true);
  });

  it('supports cancellation via AbortSignal', async () => {
    const mock = new MockProvider({ chunkDelayMs: 20 });
    const controller = new AbortController();

    // Abort shortly after starting
    setTimeout(() => controller.abort(), 10);

    await expect(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of mock.generate(
        { model: 'mock-fast', messages: [{ role: 'user', content: 'Long test' }] },
        controller.signal
      )) {
        // reading
      }
    }).rejects.toThrow();
  });
});

describe('Error Normalization and Secret Redaction', () => {
  it('redacts sk-... and Bearer credentials from error strings', () => {
    const dirty = 'Error 401: Invalid key sk-live-998877665544332211 or Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
    const clean = sanitizeErrorMessage(dirty);

    expect(clean).not.toContain('sk-live-998877665544332211');
    expect(clean).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(clean).toContain('[REDACTED_API_KEY]');
  });

  it('normalizes network errors, rate limits, timeouts, and context overflows', () => {
    const errTimeout = normalizeError(new Error('Connection timed out'));
    expect(errTimeout.code).toBe('timeout');
    expect(errTimeout.retryable).toBe(true);

    const errRate = normalizeError({ status: 429, message: 'Rate limit exceeded' });
    expect(errRate.code).toBe('rate_limited');
    expect(errRate.retryable).toBe(true);

    const errConn = normalizeError(new Error('ECONNREFUSED 127.0.0.1:11434'));
    expect(errConn.code).toBe('unavailable');
    expect(errConn.retryable).toBe(true);

    const errContext = normalizeError(new Error('maximum context length is 8192 tokens: prompt overflow'));
    expect(errContext.code).toBe('context_overflow');
    expect(errContext.retryable).toBe(false);

    const errAuth = normalizeError({ status: 401, message: 'Invalid API key' });
    expect(errAuth.code).toBe('auth');
    expect(errAuth.retryable).toBe(false);
  });

  it('handles server death and restoration cleanly', async () => {
    const mock = new MockProvider();
    mock.killServer();

    await expect(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of mock.generate({ model: 'mock-fast', messages: [{ role: 'user', content: 'test' }] })) {
        // read
      }
    }).rejects.toThrow();

    mock.restoreServer();
    const isHealthy = await mock.healthCheck();
    expect(isHealthy).toBe(true);
  });
});
