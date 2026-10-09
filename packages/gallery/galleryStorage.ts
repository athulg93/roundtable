/**
 * Template Gallery Storage & Instantiation Engine (Phase 3)
 * Manages loading, saving, importing, exporting, and converting templates
 * into runtime Group and Agent instances.
 */

import { DeliberationTemplate, TemplateBundle } from './types.ts';
import { BUILT_IN_TEMPLATES } from './templates.ts';
import { Agent, Group } from '../core/types.ts';

const CUSTOM_TEMPLATES_STORAGE_KEY = 'roundtable_custom_templates_v1';

export class GalleryStorage {
  listAllTemplates(): DeliberationTemplate[] {
    const custom = this.listCustomTemplates();
    return [...BUILT_IN_TEMPLATES, ...custom];
  }

  listCustomTemplates(): DeliberationTemplate[] {
    if (typeof window === 'undefined' || !window.localStorage) {
      return [];
    }

    try {
      const raw = localStorage.getItem(CUSTOM_TEMPLATES_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn('Failed to parse custom templates from localStorage:', err);
      return [];
    }
  }

  saveCustomTemplate(template: Omit<DeliberationTemplate, 'id'> & { id?: string }): DeliberationTemplate {
    const custom = this.listCustomTemplates();
    const finalTemplate: DeliberationTemplate = {
      ...template,
      id: template.id || `custom-tpl-${Date.now().toString(36)}`,
      isCustom: true,
    };

    const existingIndex = custom.findIndex((t) => t.id === finalTemplate.id);
    if (existingIndex >= 0) {
      custom[existingIndex] = finalTemplate;
    } else {
      custom.push(finalTemplate);
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(CUSTOM_TEMPLATES_STORAGE_KEY, JSON.stringify(custom));
    }

    return finalTemplate;
  }

  deleteCustomTemplate(templateId: string): boolean {
    const custom = this.listCustomTemplates();
    const filtered = custom.filter((t) => t.id !== templateId);
    if (filtered.length !== custom.length) {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(CUSTOM_TEMPLATES_STORAGE_KEY, JSON.stringify(filtered));
      }
      return true;
    }
    return false;
  }

  exportBundle(templates?: DeliberationTemplate[]): string {
    const bundle: TemplateBundle = {
      schemaVersion: 1,
      exportedAt: Date.now(),
      templates: templates || this.listAllTemplates(),
    };
    return JSON.stringify(bundle, null, 2);
  }

  importBundle(jsonString: string): DeliberationTemplate[] {
    const parsed = JSON.parse(jsonString) as TemplateBundle;
    if (!parsed || !Array.isArray(parsed.templates)) {
      throw new Error('Invalid template bundle format: missing templates array.');
    }

    const imported: DeliberationTemplate[] = [];
    for (const t of parsed.templates) {
      if (t.title && t.goal && Array.isArray(t.agents)) {
        const saved = this.saveCustomTemplate({ ...t, id: `imported-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}` });
        imported.push(saved);
      }
    }
    return imported;
  }

  /**
   * Instantiates a template into live Group and Agent objects.
   */
  instantiateTemplate(template: DeliberationTemplate): { group: Group; agents: Record<string, Agent> } {
    const groupId = `grp-${Date.now().toString(36)}`;
    const agentsMap: Record<string, Agent> = {};
    const agentIds: string[] = [];
    let moderatorId = '';

    template.agents.forEach((tplAgent, index) => {
      const agentId = tplAgent.id || `agent-${index + 1}-${Date.now().toString(36)}`;
      agentIds.push(agentId);

      const agent: Agent = {
        id: agentId,
        name: tplAgent.name,
        role: tplAgent.role,
        provider: tplAgent.provider || 'mock',
        model: tplAgent.model || 'mock-pro',
        rolePrompt: tplAgent.rolePrompt,
        temperature: tplAgent.temperature ?? 0.7,
        maxOutputTokens: tplAgent.maxOutputTokens || 800,
        contextBudget: tplAgent.contextBudget || 8192,
        timeoutSettings: tplAgent.timeoutSettings || { firstTokenMs: 8000, totalMs: 25000 },
        visualIdentity: tplAgent.visualIdentity || { color: '#0284c7' },
        createdAt: Date.now(),
      };

      agentsMap[agentId] = agent;
      if (agent.role === 'moderator' && !moderatorId) {
        moderatorId = agentId;
      }
    });

    if (!moderatorId && agentIds.length > 0) {
      moderatorId = agentIds[0];
    }

    const group: Group = {
      id: groupId,
      name: template.title,
      goal: template.goal,
      agentIds,
      moderatorId,
      speakerPolicy: template.speakerPolicy || 'moderator-directed',
      terminationPolicy: template.terminationPolicy || 'moderator-conclusion',
      protocol: template.suggestedProtocol || 'standard',
      maxRounds: template.maxRounds || 5,
      maxTokens: 50000,
      turnTimeoutMs: 30000,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    return { group, agents: agentsMap };
  }
}

export const defaultGalleryStorage = new GalleryStorage();
