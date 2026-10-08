/**
 * Deterministic Mock Provider (Section 8.2, P1.2)
 * Primary test tool for orchestration, streaming tokens, failure injection,
 * cancellation, context overflow, and moderator repair/fallback.
 */

import { ProviderAdapter, GenerationRequest, GenerationChunk, ModelInfo, ProviderCapabilities } from './types.ts';
import { normalizeError } from './errors.ts';

export interface MockProviderConfig {
  id?: string;
  name?: string;
  chunkDelayMs?: number;
  forcedErrorCode?: 'timeout' | 'unavailable' | 'context_overflow' | 'rate_limited' | 'auth' | null;
  failureCountdown?: number; // Fail N times, then succeed
  malformedJsonAttempts?: number; // Produce malformed JSON N times
  alwaysMalformedJson?: boolean;
  scriptedResponses?: Record<string, string>; // prompt substring or speaker -> response
  customGenerator?: (req: GenerationRequest) => string;
}

export class MockProvider implements ProviderAdapter {
  readonly id: string;
  readonly name: string;
  readonly capabilities: ProviderCapabilities = {
    streaming: true,
    supportsSystemPrompt: true,
    defaultContextWindow: 8192,
  };

  private config: MockProviderConfig;
  private attemptCount = 0;
  private isServerKilled = false;

  constructor(config: MockProviderConfig = {}) {
    this.id = config.id || 'mock';
    this.name = config.name || 'Deterministic Mock Provider';
    this.config = {
      chunkDelayMs: 5,
      failureCountdown: 0,
      malformedJsonAttempts: 0,
      ...config,
    };
  }

  updateConfig(newConfig: Partial<MockProviderConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  killServer(): void {
    this.isServerKilled = true;
  }

  restoreServer(): void {
    this.isServerKilled = false;
  }

  async *generate(
    request: GenerationRequest,
    signal?: AbortSignal
  ): AsyncIterable<GenerationChunk> {
    const startTime = Date.now();
    this.attemptCount++;

    // 1. Check if server was manually killed
    if (this.isServerKilled) {
      throw normalizeError(new Error('ECONNREFUSED: Server connection refused (killed)'));
    }

    // 2. Check injected forced errors or countdown failures
    if (this.config.forcedErrorCode) {
      const countdown = this.config.failureCountdown ?? 0;
      const shouldFail = countdown > 0
        ? this.attemptCount <= countdown
        : true;

      if (shouldFail) {
        if (this.config.forcedErrorCode === 'timeout') {
          throw normalizeError(new Error('Request timed out'));
        }
        if (this.config.forcedErrorCode === 'context_overflow') {
          throw normalizeError(new Error('Prompt too long: context length overflow'));
        }
        if (this.config.forcedErrorCode === 'unavailable') {
          throw normalizeError(new Error('503 Service Unavailable: server is overloaded'));
        }
        if (this.config.forcedErrorCode === 'rate_limited') {
          throw normalizeError(new Error('429 Too Many Requests: rate limit exceeded'));
        }
        if (this.config.forcedErrorCode === 'auth') {
          throw normalizeError(new Error('401 Unauthorized: Invalid API key'));
        }
      }
    }

    // 3. Determine Response Content
    let fullText = '';
    const lastUserMsg = request.messages[request.messages.length - 1]?.content || '';
    const isModeratorRequest =
      (request.systemPrompt && request.systemPrompt.includes('Discussion Moderator')) ||
      lastUserMsg.includes('Select the next speaker');

    if (isModeratorRequest) {
      const isRepairAttempt = lastUserMsg.includes('could not be validated') || lastUserMsg.includes('repair');
      const shouldSendMalformed =
        this.config.alwaysMalformedJson ||
        ((this.config.malformedJsonAttempts ?? 0) > 0 && !isRepairAttempt);

      if (shouldSendMalformed) {
        fullText = 'I think Alice should speak next because she knows a lot about this. (INVALID RAW TEXT NOT JSON)';
      } else {
        // Extract available participant IDs from message if present
        const matchIds = lastUserMsg.match(/- ID:\s*"([^"]+)"/g);
        let targetId = 'agent-1';
        if (matchIds && matchIds.length > 0) {
          const first = matchIds[0].replace(/- ID:\s*"/, '').replace(/"/, '');
          targetId = first;
        }

        // Conclude if turns > 6 or scripted
        const turnCountMatch = lastUserMsg.match(/Turn Count:\s*(\d+)/);
        const currentTurnCount = turnCountMatch ? parseInt(turnCountMatch[1], 10) : 0;
        if (currentTurnCount >= 6) {
          fullText = JSON.stringify({
            concluded: true,
            reason: 'Sufficient consensus has been reached on key architectural requirements.',
          });
        } else {
          fullText = JSON.stringify({
            nextSpeaker: targetId,
            concluded: false,
            reason: `Advancing perspective on the deliberation topic.`,
          });
        }
      }
    } else if (this.config.customGenerator) {
      fullText = this.config.customGenerator(request);
    } else {
      // Check scripted map
      let foundScript: string | undefined;
      if (this.config.scriptedResponses) {
        for (const [key, value] of Object.entries(this.config.scriptedResponses)) {
          if (request.systemPrompt?.includes(key) || lastUserMsg.includes(key)) {
            foundScript = value;
            break;
          }
        }
      }

      if (foundScript) {
        fullText = foundScript;
      } else {
        // Default realistic response acknowledging role
        const roleMatch = request.systemPrompt?.match(/You are ([^.\n]+)/);
        const agentName = roleMatch ? roleMatch[1] : 'Agent';
        fullText = `From the perspective of ${agentName}, we must balance system resilience with simplicity. We should standardize the event interfaces and ensure state recovery operates deterministically.`;
      }
    }

    // 4. Stream response in chunks
    const words = fullText.split(' ');
    let firstTokenLatencyMs: number | undefined;

    for (let i = 0; i < words.length; i++) {
      if (signal?.aborted) {
        throw new DOMException('Generation aborted by user signal', 'AbortError');
      }

      const chunkText = (i === 0 ? '' : ' ') + words[i];

      if (this.config.chunkDelayMs && this.config.chunkDelayMs > 0) {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => resolve(), this.config.chunkDelayMs);
          if (signal) {
            signal.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(new DOMException('Generation aborted by user signal', 'AbortError'));
            }, { once: true });
          }
        });
      }

      if (firstTokenLatencyMs === undefined) {
        firstTokenLatencyMs = Date.now() - startTime;
      }

      yield { text: chunkText };
    }

    // 5. Yield final chunk with complete usage metadata
    const inputTokenEstimate = Math.ceil(
      ((request.systemPrompt?.length || 0) +
        request.messages.reduce((acc, m) => acc + m.content.length, 0)) / 4
    );
    const outputTokenEstimate = Math.ceil(fullText.length / 4);

    yield {
      text: '',
      isFinal: true,
      usage: {
        inputTokens: inputTokenEstimate,
        outputTokens: outputTokenEstimate,
        latencyMs: Date.now() - startTime,
        firstTokenLatencyMs: firstTokenLatencyMs ?? (Date.now() - startTime),
        estimatedCost: Number(((inputTokenEstimate * 0.0000015) + (outputTokenEstimate * 0.000002)).toFixed(6)),
        provider: this.name,
        model: request.model,
      },
    };
  }

  async listModels(): Promise<ModelInfo[]> {
    return [
      { id: 'mock-fast', name: 'Mock Fast (8k)', contextWindow: 8192, supportsStreaming: true },
      { id: 'mock-pro', name: 'Mock Pro (32k)', contextWindow: 32768, supportsStreaming: true },
    ];
  }

  async healthCheck(): Promise<boolean> {
    return !this.isServerKilled;
  }
}
