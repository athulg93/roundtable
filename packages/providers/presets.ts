/**
 * Provider Presets & Metadata
 * Provides out-of-the-box configuration presets for Ollama, LM Studio, OpenAI,
 * Anthropic Claude, Google Gemini, and OpenRouter.
 */

export type SupportedProviderType =
  | 'mock'
  | 'ollama'
  | 'lmstudio'
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'openrouter'
  | 'openai-compatible';

export interface ProviderPreset {
  type: SupportedProviderType;
  label: string;
  category: 'local' | 'frontier' | 'aggregator' | 'testing';
  defaultBaseUrl?: string;
  requiresApiKey: boolean;
  apiKeyPlaceholder?: string;
  popularModels: string[];
  corsNotice?: string;
  description: string;
}

export const PROVIDER_PRESETS: Record<SupportedProviderType, ProviderPreset> = {
  mock: {
    type: 'mock',
    label: 'Deterministic Mock',
    category: 'testing',
    requiresApiKey: false,
    popularModels: ['mock-fast', 'mock-pro'],
    description: 'Instant zero-dependency simulated provider for tests, dry-runs, and failure injection.',
  },
  ollama: {
    type: 'ollama',
    label: 'Ollama (Local LLM)',
    category: 'local',
    defaultBaseUrl: 'http://localhost:11434/v1',
    requiresApiKey: false,
    popularModels: ['llama3.2', 'llama3.1:8b', 'mistral:7b', 'qwen2.5:7b', 'deepseek-r1:8b', 'phi3'],
    corsNotice: 'Requires CORS enabled: run `OLLAMA_ORIGINS="*" ollama serve`',
    description: 'Run open-weight models locally on your GPU/CPU via Ollama.',
  },
  lmstudio: {
    type: 'lmstudio',
    label: 'LM Studio (Local LLM)',
    category: 'local',
    defaultBaseUrl: 'http://localhost:1234/v1',
    requiresApiKey: false,
    popularModels: ['local-model', 'llama-3.2-3b-instruct', 'mistral-7b-instruct-v0.3'],
    corsNotice: 'Enable "CORS" in LM Studio Local Server settings.',
    description: 'Connect to models loaded in LM Studio local inference server.',
  },
  openai: {
    type: 'openai',
    label: 'OpenAI',
    category: 'frontier',
    defaultBaseUrl: 'https://api.openai.com/v1',
    requiresApiKey: true,
    apiKeyPlaceholder: 'sk-...',
    popularModels: ['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'gpt-4-turbo'],
    description: 'Industry-standard frontier models by OpenAI. Note: ChatGPT models are accessed through the OpenAI Platform API. A ChatGPT Plus subscription does not grant API access; an OpenAI API key with credit balance is required.',
  },
  anthropic: {
    type: 'anthropic',
    label: 'Anthropic Claude',
    category: 'frontier',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    requiresApiKey: true,
    apiKeyPlaceholder: 'sk-ant-api03-...',
    popularModels: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
    description: 'Advanced reasoning models with deep nuanced deliberation.',
  },
  gemini: {
    type: 'gemini',
    label: 'Google Gemini',
    category: 'frontier',
    requiresApiKey: false, // Can fall back to environment GEMINI_API_KEY
    apiKeyPlaceholder: 'AIzaSy... (leave blank to use system key)',
    popularModels: ['gemini-2.5-flash', 'gemini-2.5-pro'],
    description: 'High-speed multimodal frontier models with massive context windows.',
  },
  openrouter: {
    type: 'openrouter',
    label: 'OpenRouter',
    category: 'aggregator',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    requiresApiKey: true,
    apiKeyPlaceholder: 'sk-or-v1-...',
    popularModels: [
      'meta-llama/llama-3.3-70b-instruct',
      'anthropic/claude-3.5-sonnet',
      'deepseek/deepseek-r1',
      'google/gemini-2.0-flash-001',
    ],
    description: 'Single API key giving access to hundreds of open-source and frontier models.',
  },
  'openai-compatible': {
    type: 'openai-compatible',
    label: 'Custom OpenAI-Compatible',
    category: 'local',
    defaultBaseUrl: 'http://localhost:8000/v1',
    requiresApiKey: false,
    apiKeyPlaceholder: 'Optional API key...',
    popularModels: ['default', 'custom-model'],
    description: 'Any server providing the /v1/chat/completions endpoint (vLLM, Groq, Mistral, LocalAI).',
  },
};
