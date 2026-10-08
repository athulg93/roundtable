/**
 * Native Anthropic Provider Adapter (P1.2)
 * Connects to Anthropic Messages API with streaming and error normalization.
 */

import { ProviderAdapter, GenerationRequest, GenerationChunk, ModelInfo, ProviderCapabilities } from './types.ts';
import { normalizeError } from './errors.ts';

export interface AnthropicAdapterConfig {
  id?: string;
  name?: string;
  apiKey?: string;
  baseUrl?: string;
}

export class AnthropicAdapter implements ProviderAdapter {
  readonly id: string;
  readonly name: string;
  readonly capabilities: ProviderCapabilities = {
    streaming: true,
    supportsSystemPrompt: true,
    defaultContextWindow: 200000,
  };

  private apiKey?: string;
  private baseUrl: string;

  constructor(config: AnthropicAdapterConfig = {}) {
    this.id = config.id || 'anthropic';
    this.name = config.name || 'Anthropic Claude';
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || 'https://api.anthropic.com/v1').replace(/\/+$/, '');
  }

  setApiKey(key: string): void {
    this.apiKey = key;
  }

  async *generate(
    request: GenerationRequest,
    signal?: AbortSignal
  ): AsyncIterable<GenerationChunk> {
    const startTime = Date.now();
    let firstTokenLatencyMs: number | undefined;

    const messages = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));

    // Ensure at least one message is present
    if (messages.length === 0) {
      messages.push({ role: 'user', content: 'Begin discussion.' });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    };
    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey;
    }

    const payload = {
      model: request.model || 'claude-3-5-sonnet-20241022',
      system: request.systemPrompt,
      messages,
      max_tokens: request.maxOutputTokens ?? 1024,
      temperature: request.temperature ?? 0.7,
      stream: true,
    };

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal,
      });
    } catch (err) {
      throw normalizeError(err, 'Failed to connect to Anthropic endpoint');
    }

    if (!response.ok) {
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch {
        // ignore
      }
      throw normalizeError({
        statusCode: response.status,
        message: `HTTP ${response.status}: ${errorBody || response.statusText}`,
      });
    }

    if (!response.body) {
      throw normalizeError(new Error('Response body is null'));
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let accumulatedText = '';

    try {
      while (true) {
        if (signal?.aborted) {
          throw new DOMException('Generation aborted', 'AbortError');
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const jsonStr = trimmed.slice(6);
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              if (firstTokenLatencyMs === undefined) {
                firstTokenLatencyMs = Date.now() - startTime;
              }
              accumulatedText += parsed.delta.text;
              yield { text: parsed.delta.text };
            }
          } catch {
            // Ignore partial SSE events
          }
        }
      }
    } catch (err) {
      throw normalizeError(err);
    } finally {
      reader.releaseLock();
    }

    const inputEstimate = Math.ceil(
      ((request.systemPrompt?.length || 0) +
        request.messages.reduce((acc, m) => acc + m.content.length, 0)) / 4
    );
    const outputEstimate = Math.ceil(accumulatedText.length / 4);

    yield {
      text: '',
      isFinal: true,
      usage: {
        inputTokens: inputEstimate,
        outputTokens: outputEstimate,
        latencyMs: Date.now() - startTime,
        firstTokenLatencyMs: firstTokenLatencyMs ?? (Date.now() - startTime),
        provider: this.name,
        model: request.model,
      },
    };
  }

  async listModels(): Promise<ModelInfo[]> {
    return [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', contextWindow: 200000, supportsStreaming: true },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', contextWindow: 200000, supportsStreaming: true },
    ];
  }

  async healthCheck(): Promise<boolean> {
    return Boolean(this.apiKey);
  }
}
