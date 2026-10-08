/**
 * OpenAI-Compatible Provider Adapter (P1.2)
 * Supports Ollama, LM Studio, llama.cpp, OpenAI, OpenRouter, and any OpenAI-compatible API.
 * Uses streaming SSE and strictly redacts credentials from all error structures.
 */

import { ProviderAdapter, GenerationRequest, GenerationChunk, ModelInfo, ProviderCapabilities } from './types.ts';
import { normalizeError } from './errors.ts';

export interface OpenAIAdapterConfig {
  id?: string;
  name?: string;
  baseUrl?: string; // e.g. "http://localhost:11434/v1" or "https://api.openai.com/v1"
  apiKey?: string;
  defaultModel?: string;
}

export class OpenAICompatibleAdapter implements ProviderAdapter {
  readonly id: string;
  readonly name: string;
  readonly capabilities: ProviderCapabilities = {
    streaming: true,
    supportsSystemPrompt: true,
    defaultContextWindow: 8192,
  };

  private baseUrl: string;
  private apiKey?: string;

  constructor(config: OpenAIAdapterConfig = {}) {
    this.id = config.id || 'openai-compatible';
    this.name = config.name || 'OpenAI Compatible';
    this.baseUrl = (config.baseUrl || 'http://localhost:11434/v1').replace(/\/+$/, '');
    this.apiKey = config.apiKey;
  }

  setApiKey(key: string): void {
    this.apiKey = key;
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  async *generate(
    request: GenerationRequest,
    signal?: AbortSignal
  ): AsyncIterable<GenerationChunk> {
    const startTime = Date.now();
    let firstTokenLatencyMs: number | undefined;

    const messages = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    for (const msg of request.messages) {
      messages.push({
        role: msg.role === 'assistant' ? 'assistant' : msg.role === 'system' ? 'system' : 'user',
        content: msg.content,
      });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const payload = {
      model: request.model,
      messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxOutputTokens ?? 1024,
      stream: true,
    };

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal,
      });
    } catch (err) {
      throw normalizeError(err, 'Failed to connect to OpenAI-compatible endpoint');
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
          if (!trimmed || trimmed.startsWith(':')) continue;
          if (trimmed === 'data: [DONE]') continue;

          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.slice(6);
            try {
              const parsed = JSON.parse(jsonStr);
              const delta = parsed.choices?.[0]?.delta?.content || '';
              if (delta) {
                if (firstTokenLatencyMs === undefined) {
                  firstTokenLatencyMs = Date.now() - startTime;
                }
                accumulatedText += delta;
                yield { text: delta };
              }
            } catch {
              // Ignore partial JSON lines
            }
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
    try {
      const headers: Record<string, string> = {};
      if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;
      const res = await fetch(`${this.baseUrl}/models`, { headers });
      if (!res.ok) return [{ id: 'default', name: 'Default Model', contextWindow: 8192, supportsStreaming: true }];
      const data = await res.json();
      if (Array.isArray(data.data)) {
        return data.data.map((m: { id: string }) => ({
          id: m.id,
          name: m.id,
          contextWindow: 8192,
          supportsStreaming: true,
        }));
      }
      return [{ id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, supportsStreaming: true }];
    } catch {
      return [
        { id: 'llama3:8b', name: 'Llama 3 8B (Ollama)', contextWindow: 8192, supportsStreaming: true },
        { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, supportsStreaming: true },
      ];
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const headers: Record<string, string> = {};
      if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;
      const res = await fetch(`${this.baseUrl}/models`, { method: 'GET', headers });
      return res.ok;
    } catch {
      return false;
    }
  }
}
