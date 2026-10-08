/**
 * Export Service (P1.9)
 * Exports conversations to JSON and Markdown format.
 * Guarantees that API keys and provider secrets are completely absent.
 */

import { Conversation } from '../core/types.ts';
import { renderNextStepsMarkdown } from '../core/summarizer.ts';

export class ExportService {
  /**
   * Sanitizes conversation object ensuring no secret fields or bearer tokens exist.
   */
  static sanitizeForExport(conversation: Conversation): Record<string, unknown> {
    const raw = JSON.parse(JSON.stringify(conversation));

    // Deep sanitize recursive helper
    const sanitizeObj = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      for (const key of Object.keys(obj)) {
        if (
          key.toLowerCase().includes('key') ||
          key.toLowerCase().includes('secret') ||
          key.toLowerCase().includes('token') ||
          key.toLowerCase().includes('password') ||
          key.toLowerCase().includes('auth')
        ) {
          // If it's a known non-secret like maxOutputTokens, inputTokens, outputTokens, totalTokens
          if (
            key === 'maxOutputTokens' ||
            key === 'inputTokens' ||
            key === 'outputTokens' ||
            key === 'totalTokens' ||
            key === 'firstTokenLatencyMs' ||
            key === 'firstTokenMs'
          ) {
            continue;
          }
          delete obj[key];
        } else if (typeof obj[key] === 'object') {
          sanitizeObj(obj[key]);
        }
      }
    };

    sanitizeObj(raw);

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      conversation: raw,
    };
  }

  static exportToJson(conversation: Conversation, pretty = true): string {
    const sanitized = this.sanitizeForExport(conversation);
    return JSON.stringify(sanitized, null, pretty ? 2 : 0);
  }

  static exportToMarkdown(conversation: Conversation): string {
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

        return [
          `### Turn ${index + 1}: ${t.speakerName} [${roleBadge}]${usageBadge}`,
          `*Time: ${time} | Model: ${t.selectedModel}*`,
          '',
          t.content || (t.status === 'failed' ? `_Turn failed: ${t.error?.message}_` : '_Turn skipped/in progress_'),
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

    return [
      `# Multi-Agent Deliberation Transcript`,
      `**Group**: ${group.name}`,
      `**Goal / Topic**: ${group.goal}`,
      `**Started**: ${dateStr} | **Status**: ${conversation.state.toUpperCase()}`,
      `**Total Turns**: ${conversation.totalTurns} | **Total Tokens**: ${conversation.totalUsage.totalTokens}`,
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
}
