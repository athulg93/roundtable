/**
 * Provider Error Normalization (P1.2, P1.6)
 * Normalizes vendor-specific network/API errors into typed domain failures.
 * Strips secrets, keys, and authorization headers from error messages.
 */

import { NormalizedProviderError, ProviderErrorCode } from '../core/types.ts';

export function sanitizeErrorMessage(message: string): string {
  // Redact potential API keys (sk-..., AIzaSy..., bearer tokens, etc.)
  return message
    .replace(/(bearer\s+)[a-zA-Z0-9_\-\.]{8,}/gi, '$1[REDACTED]')
    .replace(/(sk-[a-zA-Z0-9_\-]{16,})/gi, '[REDACTED_API_KEY]')
    .replace(/(AIzaSy[a-zA-Z0-9_\-]{20,})/gi, '[REDACTED_API_KEY]')
    .replace(/("apiKey"\s*:\s*")[^"]+(")/gi, '$1[REDACTED]$2')
    .replace(/(x-api-key\s*:\s*)[^\r\n,]+/gi, '$1[REDACTED]');
}

export function normalizeError(error: unknown, defaultMessage = 'Model generation failed'): NormalizedProviderError {
  if (!error) {
    return {
      code: 'unknown',
      message: defaultMessage,
      retryable: false,
    };
  }

  // If already normalized
  if (typeof error === 'object' && error !== null && 'code' in error && 'message' in error) {
    const err = error as Partial<NormalizedProviderError>;
    return {
      code: (err.code as ProviderErrorCode) || 'unknown',
      message: sanitizeErrorMessage(err.message || defaultMessage),
      retryable: err.retryable ?? false,
      statusCode: err.statusCode,
    };
  }

  const errObj = error as Record<string, unknown>;
  const rawMsg = String(errObj.message || error || defaultMessage);
  const msg = sanitizeErrorMessage(rawMsg);
  const status = typeof errObj.status === 'number' ? errObj.status : typeof errObj.statusCode === 'number' ? errObj.statusCode : undefined;

  // 1. Timeout / Abort
  if (
    msg.toLowerCase().includes('timeout') ||
    msg.toLowerCase().includes('timed out') ||
    errObj.name === 'TimeoutError'
  ) {
    return {
      code: 'timeout',
      message: 'Request timed out waiting for model response.',
      retryable: true,
      statusCode: status,
      rawError: msg,
    };
  }

  // 2. Auth error
  if (status === 401 || status === 403 || msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('api key')) {
    return {
      code: 'auth',
      message: 'Authentication failed. Please verify provider credentials.',
      retryable: false,
      statusCode: status || 401,
      rawError: msg,
    };
  }

  // 3. Rate limiting
  if (status === 429 || msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('quota exceeded') || msg.toLowerCase().includes('too many requests')) {
    return {
      code: 'rate_limited',
      message: 'Provider rate limit reached. Backing off.',
      retryable: true,
      statusCode: 429,
      rawError: msg,
    };
  }

  // 4. Context overflow
  if (
    msg.toLowerCase().includes('context') &&
    (msg.toLowerCase().includes('overflow') || msg.toLowerCase().includes('maximum context') || msg.toLowerCase().includes('token limit') || msg.toLowerCase().includes('prompt too long'))
  ) {
    return {
      code: 'context_overflow',
      message: 'Context length exceeded agent model budget.',
      retryable: false,
      statusCode: 400,
      rawError: msg,
    };
  }

  // 5. Server unavailable / network error
  if (
    status === 502 ||
    status === 503 ||
    status === 504 ||
    msg.toLowerCase().includes('econnrefused') ||
    msg.toLowerCase().includes('fetch failed') ||
    msg.toLowerCase().includes('network') ||
    msg.toLowerCase().includes('connection refused')
  ) {
    return {
      code: 'unavailable',
      message: 'Model provider or server is currently unreachable.',
      retryable: true,
      statusCode: status || 503,
      rawError: msg,
    };
  }

  return {
    code: 'unknown',
    message: msg,
    retryable: false,
    statusCode: status,
    rawError: msg,
  };
}
