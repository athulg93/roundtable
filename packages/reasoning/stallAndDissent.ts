/**
 * Stall Detection & Dissent Log Engine (Phase 2 - P2.5)
 * Detects conversational loops, circular argumentation, and stalls.
 * Immutably records minority objections and dissenting viewpoints.
 */

import { Conversation, DissentItem, Turn } from '../core/types.ts';

export interface StallDetectionResult {
  stalled: boolean;
  similarityScore: number;
  reason?: string;
  suggestedIntervention?: string;
}

/**
 * Computes Jaccard word-set similarity between two text snippets.
 */
function wordOverlapSimilarity(a: string, b: string): number {
  const wordsA = new Set(
    a
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );
  const wordsB = new Set(
    b
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  const minSize = Math.min(wordsA.size, wordsB.size);
  return minSize === 0 ? 0 : intersection / minSize;
}

/**
 * Detects circular loops or semantic stagnation across the most recent turns.
 * Flags a stall if recent turns have excessive semantic overlap without advancing conclusions.
 */
export function detectStall(
  conversation: Conversation,
  options: { threshold?: number; windowSize?: number } = {}
): StallDetectionResult {
  const threshold = options.threshold ?? 0.65;
  const windowSize = options.windowSize ?? 4;

  const validTurns = conversation.turns.filter(
    (t) => t.status === 'completed' && t.content.trim().length > 20
  );

  if (validTurns.length < windowSize) {
    return { stalled: false, similarityScore: 0 };
  }

  const recentTurns = validTurns.slice(-windowSize);

  // Compare each pair in the recent window
  let highSimilarityPairs = 0;
  let totalPairs = 0;
  let maxSimilarity = 0;
  let sumSimilarity = 0;

  for (let i = 0; i < recentTurns.length; i++) {
    for (let j = i + 1; j < recentTurns.length; j++) {
      totalPairs++;
      const sim = wordOverlapSimilarity(recentTurns[i].content, recentTurns[j].content);
      sumSimilarity += sim;
      if (sim > maxSimilarity) maxSimilarity = sim;
      if (sim >= threshold) {
        highSimilarityPairs++;
      }
    }
  }

  const avgSimilarity = totalPairs > 0 ? sumSimilarity / totalPairs : 0;
  // Stalled if multiple pairs exceed threshold or average similarity exceeds 75% of threshold
  const stalled = highSimilarityPairs >= 2 || avgSimilarity >= threshold * 0.75 || maxSimilarity >= Math.max(threshold, 0.7);

  if (stalled) {
    return {
      stalled: true,
      similarityScore: Math.round(maxSimilarity * 100) / 100,
      reason: `Circular reasoning detected across turns: vocabulary overlap exceeded ${Math.round(threshold * 100)}%.`,
      suggestedIntervention:
        'Moderator should force a resolution vote, solicit external counter-evidence, or transition to a dissenting round.',
    };
  }

  return { stalled: false, similarityScore: Math.round(maxSimilarity * 100) / 100 };
}

/**
 * Creates a structured DissentItem for permanent archival in the immutable Dissent Log.
 */
export function createDissentItem(
  objection: string,
  topic: string,
  agentId: string,
  agentName: string
): DissentItem {
  return {
    id: `dis-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    agentId,
    agentName,
    topic: topic.trim(),
    objection: objection.trim(),
    timestamp: Date.now(),
  };
}

/**
 * Extracts explicit dissent statements from turn content.
 * Matches syntax:
 *   [Dissent: ...]
 *   [Objection: ...]
 *   [Formal Reservation: ...]
 */
export function extractDissentItems(
  content: string,
  topic: string,
  agentId: string,
  agentName: string
): DissentItem[] {
  const items: DissentItem[] = [];

  const patterns = [
    /\[(?:Dissent|DISSENT)\]:\s*([^\n\r]+)/g,
    /\[(?:Objection|OBJECTION)\]:\s*([^\n\r]+)/g,
    /\[(?:Formal Reservation|RESERVATION)\]:\s*([^\n\r]+)/g,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      if (match[1] && match[1].trim().length > 5) {
        items.push(createDissentItem(match[1].trim(), topic, agentId, agentName));
      }
    }
  }

  return items;
}
