/**
 * Gemini Provider Adapter
 * Connects to Google GenAI SDK (@google/genai) using environment API key or configured key.
 */

import { GoogleGenAI } from '@google/genai';
import { ProviderAdapter, GenerationRequest, GenerationChunk, ModelInfo, ProviderCapabilities } from './types.ts';
import { normalizeError } from './errors.ts';

export interface GeminiAdapterConfig {
  id?: string;
  name?: string;
  apiKey?: string;
}

export class GeminiAdapter implements ProviderAdapter {
  readonly id: string;
  readonly name: string;
  readonly capabilities: ProviderCapabilities = {
    streaming: true,
    supportsSystemPrompt: true,
    defaultContextWindow: 1000000,
  };

  private apiKey?: string;

  constructor(config: GeminiAdapterConfig = {}) {
    this.id = config.id || 'gemini';
    this.name = config.name || 'Google Gemini';
    this.apiKey = config.apiKey || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : undefined);
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

    const apiKey = this.apiKey || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : undefined);
    const ai = new GoogleGenAI(apiKey ? { apiKey } : undefined);

    const modelName = request.model || 'gemini-2.5-flash';

    // Format contents
    const contents = request.messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    if (contents.length === 0) {
      contents.push({ role: 'user', parts: [{ text: 'Begin discussion.' }] });
    }

    let accumulatedText = '';
    try {
      if (signal?.aborted) {
        throw new DOMException('Generation aborted', 'AbortError');
      }

      const responseStream = await ai.models.generateContentStream({
        model: modelName,
        contents,
        config: {
          systemInstruction: request.systemPrompt,
          temperature: request.temperature ?? 0.7,
          maxOutputTokens: request.maxOutputTokens ?? 1024,
          abortSignal: signal,
        },
      });

      for await (const chunk of responseStream) {
        if (signal?.aborted) {
          throw new DOMException('Generation aborted', 'AbortError');
        }
        const text = chunk.text || '';
        if (text) {
          if (firstTokenLatencyMs === undefined) {
            firstTokenLatencyMs = Date.now() - startTime;
          }
          accumulatedText += text;
          yield { text };
        }
      }
    } catch (err) {
      throw normalizeError(err, 'Gemini generation failed');
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
        model: modelName,
      },
    };
  }

  async listModels(): Promise<ModelInfo[]> {
    return [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', contextWindow: 1048576, supportsStreaming: true },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', contextWindow: 2097152, supportsStreaming: true },
    ];
  }

  async healthCheck(): Promise<boolean> {
    const key = this.apiKey || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : undefined);
    return Boolean(key);
  }
}
