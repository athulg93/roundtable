/**
 * In-Memory Session Credential Store
 * 
 * Complies with strict security requirements:
 * - Credentials and API keys are kept strictly in memory for the active browser session.
 * - NEVER saved in localStorage, sessionStorage, exports, or conversation logs.
 * - Cleared automatically on page refresh or explicit reset.
 */

import { SupportedProviderType } from '../providers/presets.ts';

export interface ProviderCredentials {
  apiKey?: string;
  baseUrl?: string;
}

class SessionCredentialStore {
  // Global provider default credentials
  private providerDefaults = new Map<SupportedProviderType, ProviderCredentials>();

  // Agent-specific credential overrides (keyed by agent ID)
  private agentCredentials = new Map<string, ProviderCredentials & { providerType?: SupportedProviderType }>();

  // Set global credentials for a provider type (e.g. Gemini, Claude, OpenAI)
  setProviderDefault(type: SupportedProviderType, creds: ProviderCredentials) {
    this.providerDefaults.set(type, {
      ...this.providerDefaults.get(type),
      ...creds,
    });
  }

  getProviderDefault(type: SupportedProviderType): ProviderCredentials {
    return this.providerDefaults.get(type) || {};
  }

  // Set specific credentials for an agent
  setAgentCredentials(agentId: string, creds: ProviderCredentials & { providerType?: SupportedProviderType }) {
    this.agentCredentials.set(agentId, {
      ...this.agentCredentials.get(agentId),
      ...creds,
    });
  }

  getAgentCredentials(agentId: string, providerType?: SupportedProviderType): ProviderCredentials {
    const specific = this.agentCredentials.get(agentId) || {};
    const effectiveType = providerType || specific.providerType || 'mock';
    const fallback = this.providerDefaults.get(effectiveType) || {};

    return {
      apiKey: specific.apiKey || fallback.apiKey || '',
      baseUrl: specific.baseUrl || fallback.baseUrl || '',
    };
  }

  // Remove agent credentials
  removeAgentCredentials(agentId: string) {
    this.agentCredentials.delete(agentId);
  }

  // Clear all in-memory credentials
  clearAll() {
    this.providerDefaults.clear();
    this.agentCredentials.clear();
  }
}

export const sessionCredentials = new SessionCredentialStore();
