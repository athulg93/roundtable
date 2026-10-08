/**
 * Shared Structured Blackboard Engine (Phase 2 - P2.1)
 * Manages working memory visible to all agents: decisions, hypotheses, assumptions, open questions.
 */

import { BlackboardItem } from '../core/types.ts';

export function createBlackboardItem(
  category: 'decision' | 'hypothesis' | 'assumption' | 'open_question',
  text: string,
  authorId: string,
  authorName: string
): BlackboardItem {
  return {
    id: `bb-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    category,
    text: text.trim(),
    authorId,
    authorName,
    status: 'active',
    timestamp: Date.now(),
  };
}

/**
 * Extracts candidate blackboard items from structured model output or regex patterns.
 * Supports explicit tags like [Decision: ...], [Hypothesis: ...], [Assumption: ...], [Question: ...]
 */
export function extractBlackboardItems(
  content: string,
  authorId: string,
  authorName: string
): BlackboardItem[] {
  const items: BlackboardItem[] = [];

  const patterns: Array<{
    regex: RegExp;
    category: 'decision' | 'hypothesis' | 'assumption' | 'open_question';
  }> = [
    { regex: /\[(?:Decision|DECISION)\]:\s*([^\n\r]+)/g, category: 'decision' },
    { regex: /\[(?:Hypothesis|HYPOTHESIS)\]:\s*([^\n\r]+)/g, category: 'hypothesis' },
    { regex: /\[(?:Assumption|ASSUMPTION)\]:\s*([^\n\r]+)/g, category: 'assumption' },
    { regex: /\[(?:Question|QUESTION|Open Question)\]:\s*([^\n\r]+)/g, category: 'open_question' },
  ];

  for (const { regex, category } of patterns) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      if (match[1] && match[1].trim().length > 5) {
        items.push(createBlackboardItem(category, match[1].trim(), authorId, authorName));
      }
    }
  }

  return items;
}
