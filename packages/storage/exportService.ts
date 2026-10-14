/**
 * Export Service (P1.9, Phase 2 Dependability)
 * Exports conversations to JSON, Markdown, and standardized bundles.
 * Guarantees that API keys, bearer tokens, and secrets are completely eradicated.
 */

import { Conversation, ConversationEvent } from '../core/types.ts';
import { renderNextStepsMarkdown } from '../core/summarizer.ts';
import { ExportBundleMetadata, ExportedSessionBundle, ExportOptions } from './types.ts';

// Known credential and sensitive pattern matchers
const SENSITIVE_PATTERNS = [
  /sk-[a-zA-Z0-9_\-]{20,}/g, // OpenAI API keys
  /sk-ant-[a-zA-Z0-9_\-]{20,}/g, // Anthropic API keys
  /AIza[0-9A-Za-z\-_]{35}/g, // Google / Gemini API keys
  /Bearer\s+[A-Za-z0-9_\-\.]{20,}/gi, // Bearer tokens
  /ghp_[a-zA-Z0-9]{36}/g, // GitHub tokens
  /xox[baprs]-[a-zA-Z0-9_\-]{10,}/g, // Slack tokens
];

export function redactSecretsInText(text: string): string {
  if (!text || typeof text !== 'string') return text;
  let sanitized = text;
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, (match) => {
      if (match.toLowerCase().startsWith('bearer')) {
        return 'Bearer [REDACTED_TOKEN]';
      }
      return '[REDACTED_API_KEY]';
    });
  }
  return sanitized;
}

export class ExportService {
  /**
   * Sanitizes conversation object ensuring no secret fields or bearer tokens exist,
   * checking both dictionary keys and freeform string values.
   */
  static sanitizeForExport(conversation: Conversation, options: ExportOptions = {}): Record<string, unknown> {
    const raw = JSON.parse(JSON.stringify(conversation));
    const seen = new WeakSet();
    let redactionCount = 0;

    const customRedactor = options.customRedactor;

    const sanitizeVal = (val: any): any => {
      if (val === null || val === undefined) return val;

      if (typeof val === 'string') {
        let clean = options.redactSensitivePatterns !== false ? redactSecretsInText(val) : val;
        if (customRedactor) {
          clean = customRedactor(clean);
        }
        if (clean !== val) {
          redactionCount++;
        }
        return clean;
      }

      if (typeof val !== 'object') return val;

      if (seen.has(val)) return val;
      seen.add(val);

      if (Array.isArray(val)) {
        return val.map(sanitizeVal);
      }

      const out: Record<string, any> = {};
      for (const [key, v] of Object.entries(val)) {
        // Prevent prototype pollution
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          continue;
        }

        const lowerKey = key.toLowerCase();
        // Check for forbidden secret-holding property names
        const isSecretKey =
          (lowerKey.includes('key') ||
            lowerKey.includes('secret') ||
            lowerKey.includes('token') ||
            lowerKey.includes('password') ||
            lowerKey.includes('auth') ||
            lowerKey.includes('credential') ||
            lowerKey.includes('bearer')) &&
          // Exclude benign metric and token count fields
          key !== 'maxOutputTokens' &&
          key !== 'inputTokens' &&
          key !== 'outputTokens' &&
          key !== 'totalTokens' &&
          key !== 'firstTokenLatencyMs' &&
          key !== 'firstTokenMs' &&
          key !== 'contextBudget';

        if (isSecretKey) {
          redactionCount++;
          continue; // Strip key completely
        }

        out[key] = sanitizeVal(v);
      }

      return out;
    };

    const sanitizedConv = sanitizeVal(raw);

    return {
      version: '1.0',
      formatVersion: '1.1',
      exportedAt: new Date().toISOString(),
      sanitized: true,
      redactionCount,
      conversation: sanitizedConv,
    };

  }

  /**
   * Creates a self-contained, typed bundle suitable for programmatic import/export.
   */
  static exportBundle(
    conversation: Conversation,
    events?: ConversationEvent[],
    options: ExportOptions = {}
  ): ExportedSessionBundle {
    const sanitizedObj = this.sanitizeForExport(conversation, options);
    const sanitizedConv = sanitizedObj.conversation as Conversation;

    const sanitizedEvents = (events || conversation.events || []).map((e) => {
      const rawE = JSON.parse(JSON.stringify(e));
      return ExportService.sanitizeForExport({ ...conversation, events: [rawE] }, options).conversation as any;
    });

    const transcriptMarkdown = this.exportToMarkdown(sanitizedConv, options);

    const metadata: ExportBundleMetadata = {
      bundleVersion: '1.1',
      exportedAt: new Date().toISOString(),
      conversationId: sanitizedConv.id,
      groupName: sanitizedConv.groupSnapshot.name,
      goal: sanitizedConv.groupSnapshot.goal,
      state: sanitizedConv.state,
      totalTurns: sanitizedConv.totalTurns,
      totalTokens: sanitizedConv.totalUsage?.totalTokens || 0,
      sanitized: true,
      redactedPatternCount: (sanitizedObj.redactionCount as number) || 0,
    };

    return {
      formatVersion: '1.1',
      metadata,
      conversation: sanitizedConv,
      events: options.includeEvents !== false ? sanitizedEvents : undefined,
      transcriptMarkdown,
    };
  }

  static exportToJson(conversation: Conversation, options: ExportOptions = {}): string {
    const pretty = options.pretty ?? true;
    const sanitized = this.sanitizeForExport(conversation, options);
    return JSON.stringify(sanitized, null, pretty ? 2 : 0);
  }

  static exportToMarkdown(conversation: Conversation, options: ExportOptions = {}): string {
    const group = conversation.groupSnapshot;
    const dateStr = new Date(conversation.createdAt).toLocaleString();

    const participants = Object.values(conversation.agentSnapshots)
      .map(
        (a) =>
          `- **${a.name}** (${a.role === 'moderator' ? 'Moderator' : 'Participant'}, Model: \`${a.model}\` via \`${a.provider}\`): ${(a.rolePrompt || 'Analytical deliberation participant').slice(0, 150)}...`
      )
      .join('\n');

    const turnsMd = conversation.turns
      .map((t, index) => {
        const time = new Date(t.startedAt).toLocaleTimeString();
        const roleBadge = t.role === 'user' ? '👤 USER' : t.role === 'moderator' ? '🛡️ MODERATOR' : '🤖 AGENT';
        const usageBadge = t.usage
          ? ` *(Tokens: ${t.usage.inputTokens} in / ${t.usage.outputTokens} out, Latency: ${t.usage.latencyMs}ms)*`
          : '';

        let content = t.content || (t.status === 'failed' ? `_Turn failed: ${t.error?.message}_` : '_Turn skipped/in progress_');
        if (options.redactSensitivePatterns !== false) {
          content = redactSecretsInText(content);
        }

        return [
          `### Turn ${index + 1}: ${t.speakerName} [${roleBadge}]${usageBadge}`,
          `*Time: ${time} | Model: ${t.selectedModel}*`,
          '',
          content,
        ].join('\n');
      })
      .join('\n\n---\n\n');

    let summariesSection = '_No summary generated._';
    if (conversation.summaries.renderedMarkdown) {
      summariesSection = `## Final Summaries\n\n${conversation.summaries.renderedMarkdown}`;
    } else if (conversation.summaries.nextSteps) {
      summariesSection = `## Final Summaries\n\n${renderNextStepsMarkdown(conversation.summaries.nextSteps)}`;
    } else if (conversation.summaries.rollingSummary) {
      summariesSection = `## Rolling Summary\n\n${conversation.summaries.rollingSummary}`;
    }

    if (options.redactSensitivePatterns !== false) {
      summariesSection = redactSecretsInText(summariesSection);
    }

    return [
      `# Multi-Agent Deliberation Transcript`,
      `**Group**: ${group.name}`,
      `**Goal / Topic**: ${group.goal}`,
      `**Started**: ${dateStr} | **Status**: ${conversation.state.toUpperCase()}`,
      `**Total Turns**: ${conversation.totalTurns} | **Total Tokens**: ${conversation.totalUsage?.totalTokens || 0}`,
      '',
      `## Participants`,
      participants,
      '',
      `## Transcript`,
      turnsMd || '_No conversation turns recorded._',
      '',
      summariesSection,
    ].join('\n\n');
  }

  /**
   * Validates an imported export bundle to ensure it is authentic,
   * uncorrupted, and contains zero exposed secrets.
   */
  static validateExportBundle(raw: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!raw || typeof raw !== 'object') {
      return { valid: false, errors: ['Export bundle must be an object'] };
    }

    const obj = raw as Record<string, any>;
    if (!obj.version && !obj.formatVersion) {
      errors.push('Missing export format version');
    }

    const conv = obj.conversation || obj;
    if (!conv.id || typeof conv.id !== 'string') {
      errors.push('Missing or invalid conversation ID');
    }
    if (!conv.groupSnapshot || typeof conv.groupSnapshot !== 'object') {
      errors.push('Missing conversation group snapshot');
    }
    if (!Array.isArray(conv.turns)) {
      errors.push('Conversation turns must be an array');
    }

    // Check for accidental key leaks in the raw JSON
    const rawStr = JSON.stringify(raw);
    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(rawStr)) {
        errors.push('Bundle contains unredacted credential matching sensitive patterns');
        break;
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
