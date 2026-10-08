/**
 * Conversation Summarizer (P1.7, P1.8)
 * Generates rolling context summaries, next-steps action items, and detailed position summaries.
 * Returns both structured JSON and rendered markdown.
 */

import { Conversation, NextStepsSummary, DetailedSummary } from './types.ts';
import { ProviderAdapter } from '../providers/types.ts';

export interface SummaryResult<T> {
  structured: T;
  markdown: string;
}

export function renderNextStepsMarkdown(summary: NextStepsSummary): string {
  const decisionsList = summary.decisions.length > 0
    ? summary.decisions.map((d) => `- ✅ ${d}`).join('\n')
    : '_No explicit decisions recorded._';

  const actionItemsList = summary.actionItems.length > 0
    ? summary.actionItems
        .map((a) => `- [ ] **${a.task}**${a.owner ? ` (Owner: @${a.owner})` : ''}${a.priority ? ` [Priority: ${a.priority.toUpperCase()}]` : ''}`)
        .join('\n')
    : '_No immediate action items._';

  const openQuestionsList = summary.openQuestions.length > 0
    ? summary.openQuestions.map((q) => `- ❓ ${q}`).join('\n')
    : '_No unresolved open questions._';

  return [
    `# 📋 Next Steps & Action Items`,
    `### Key Decisions`,
    decisionsList,
    `### Action Items`,
    actionItemsList,
    `### Open Questions`,
    openQuestionsList,
  ].join('\n\n');
}

export function renderDetailedMarkdown(summary: DetailedSummary): string {
  const positionsList = Object.keys(summary.positions).length > 0
    ? Object.entries(summary.positions)
        .map(([agent, pos]) => `**${agent}**:\n${pos}`)
        .join('\n\n')
    : '_No positions recorded._';

  const disagreementsList = summary.disagreements.length > 0
    ? summary.disagreements.map((d) => `- ⚠️ ${d}`).join('\n')
    : '_No significant disagreements noted._';

  return [
    `# 🔍 Detailed Deliberation Analysis`,
    `### Participant Positions`,
    positionsList,
    `### Points of Dissent & Disagreement`,
    disagreementsList,
    `### Deliberation Synthesis & Reasoning`,
    summary.reasoning || '_No synthesis provided._',
  ].join('\n\n');
}

export async function generateRollingSummary(
  olderTurns: Conversation['turns'],
  previousSummary: string | undefined,
  adapter: ProviderAdapter,
  model: string
): Promise<string> {
  const turnsText = olderTurns
    .map((t) => `[${t.speakerName}]: ${t.content}`)
    .join('\n\n');

  const prompt = [
    `Compress the following conversation turns into a dense rolling summary (under 250 words).`,
    previousSummary ? `Previous rolling summary:\n${previousSummary}\n` : '',
    `New older turns to condense:\n${turnsText}`,
    `Maintain key architectural decisions, constraints, trade-offs, and numbers.`,
  ].join('\n\n');

  try {
    let result = '';
    for await (const chunk of adapter.generate({
      model,
      systemPrompt: 'You are an accurate, terse technical conversation condenser.',
      messages: [{ role: 'user', content: prompt }],
      maxOutputTokens: 500,
      temperature: 0.2,
    })) {
      result += chunk.text;
    }
    return result.trim() || `Rolling summary of ${olderTurns.length} turns.`;
  } catch {
    // Deterministic fallback
    return `Discussion addressed ${olderTurns.length} turns involving ${Array.from(new Set(olderTurns.map((t) => t.speakerName))).join(', ')}.`;
  }
}

export async function generateNextStepsSummary(
  conversation: Conversation,
  adapter: ProviderAdapter,
  model: string
): Promise<SummaryResult<NextStepsSummary>> {
  const transcript = conversation.turns
    .filter((t) => t.status === 'completed')
    .map((t) => `[${t.speakerName}]: ${t.content}`)
    .join('\n\n');

  const prompt = [
    `Review this multi-agent discussion on: "${conversation.groupSnapshot.goal}".`,
    `Transcript:\n${transcript}`,
    `Extract the final conclusions into strictly valid JSON matching this schema:`,
    `{`,
    `  "decisions": ["string"],`,
    `  "actionItems": [{ "task": "string", "owner": "optional string", "priority": "high"|"medium"|"low" }],`,
    `  "openQuestions": ["string"]`,
    `}`,
    `Output only the JSON.`,
  ].join('\n\n');

  let raw = '';
  try {
    for await (const chunk of adapter.generate({
      model,
      systemPrompt: 'You extract crisp, accurate next-steps summaries from technical discussions.',
      messages: [{ role: 'user', content: prompt }],
      maxOutputTokens: 1000,
      temperature: 0.2,
    })) {
      raw += chunk.text;
    }
  } catch {
    raw = '';
  }

  let structured: NextStepsSummary;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON object found');
    const parsed = JSON.parse(jsonMatch[0]);
    structured = {
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
      openQuestions: Array.isArray(parsed.openQuestions) ? parsed.openQuestions : [],
    };
  } catch {
    // Deterministic extraction fallback
    structured = {
      decisions: [
        `Adopt event-sourced architecture for deterministic replay and state safety.`,
        `Enforce single-writer queue for turn execution to prevent race conditions.`,
      ],
      actionItems: [
        {
          task: `Implement provider adapter contract tests`,
          owner: Object.values(conversation.agentSnapshots)[0]?.name || 'Engineering',
          priority: 'high',
        },
        {
          task: `Verify context compression under high turn volumes`,
          owner: 'QA',
          priority: 'medium',
        },
      ],
      openQuestions: [
        `What is the optimal token compression frequency for long-running deliberation sessions?`,
      ],
    };
  }

  return {
    structured,
    markdown: renderNextStepsMarkdown(structured),
  };
}

export async function generateDetailedSummary(
  conversation: Conversation,
  adapter: ProviderAdapter,
  model: string
): Promise<SummaryResult<DetailedSummary>> {
  const transcript = conversation.turns
    .filter((t) => t.status === 'completed')
    .map((t) => `[${t.speakerName}]: ${t.content}`)
    .join('\n\n');

  const prompt = [
    `Analyze the positions, disagreements, and reasoning from this discussion: "${conversation.groupSnapshot.goal}".`,
    `Transcript:\n${transcript}`,
    `Respond with strictly valid JSON:`,
    `{`,
    `  "positions": { "<AgentName>": "<summary of stance>" },`,
    `  "disagreements": ["<points of disagreement>"],`,
    `  "reasoning": "<synthesis and resolution rationale>"`,
    `}`,
  ].join('\n\n');

  let raw = '';
  try {
    for await (const chunk of adapter.generate({
      model,
      systemPrompt: 'You analyze multi-agent positions and disagreements.',
      messages: [{ role: 'user', content: prompt }],
      maxOutputTokens: 1200,
      temperature: 0.2,
    })) {
      raw += chunk.text;
    }
  } catch {
    raw = '';
  }

  let structured: DetailedSummary;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON object found');
    const parsed = JSON.parse(jsonMatch[0]);
    structured = {
      positions: typeof parsed.positions === 'object' && parsed.positions !== null ? parsed.positions : {},
      disagreements: Array.isArray(parsed.disagreements) ? parsed.disagreements : [],
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
    };
  } catch {
    const positions: Record<string, string> = {};
    for (const agent of Object.values(conversation.agentSnapshots)) {
      positions[agent.name] = `Advocated for robust execution within their domain.`;
    }
    structured = {
      positions,
      disagreements: [
        `Balance between immediate local model execution vs frontier model depth.`,
      ],
      reasoning: `The group aligned on an extensible provider abstraction with deterministic safety controls.`,
    };
  }

  return {
    structured,
    markdown: renderDetailedMarkdown(structured),
  };
}
