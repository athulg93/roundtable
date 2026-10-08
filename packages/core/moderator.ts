/**
 * Moderator Decision Engine (P1.4)
 * Handles structured decision parsing, schema validation, repair prompting,
 * and deterministic safe fallback to ensure conversations NEVER deadlock.
 */

import { Agent, Conversation, ModeratorDecision } from './types.ts';

export const MODERATOR_SYSTEM_PROMPT = `You are the Discussion Moderator.
Your job is to orchestrate a focused, balanced, and productive deliberation among the participants.

At each turn, evaluate the state of the discussion against the overall topic/goal.
Decide:
1. Who should speak next among the available participants to advance the discussion, OR
2. Whether the group has reached a solid conclusion / consensus and should wrap up.

You MUST respond strictly with a valid JSON object matching this schema:
{
  "nextSpeaker": "<exact_agent_id_of_next_speaker>",
  "concluded": false,
  "reason": "<one or two sentences explaining why this speaker was selected or why discussion is concluded>"
}

RULES:
- When concluded is false, nextSpeaker MUST be one of the provided participant agent IDs.
- When concluded is true, nextSpeaker can be omitted or null.
- Provide a clear, actionable reason.
- Output ONLY the raw JSON object. Do not wrap in markdown quotes if possible, and include no extra text.`;

export function buildModeratorPrompt(
  conversation: Conversation,
  participants: Agent[]
): string {
  const group = conversation.groupSnapshot;
  const validAgentList = participants
    .map((p) => `- ID: "${p.id}" | Name: "${p.name}" | Persona: ${p.rolePrompt.slice(0, 100)}`)
    .join('\n');

  const recentTurns = conversation.turns
    .filter((t) => t.status === 'completed')
    .slice(-8)
    .map((t) => `[${t.speakerName}]: ${t.content.slice(0, 300)}`)
    .join('\n\n');

  return [
    `Discussion Goal / Topic: ${group.goal}`,
    `Turn Count: ${conversation.totalTurns}`,
    `Participant Roster:\n${validAgentList}`,
    `Recent Turns:\n${recentTurns || '(No turns yet. Ready for first speaker)'}`,
    `Select the next speaker or declare conclusion now as JSON:`,
  ].join('\n\n');
}

export function parseModeratorDecision(
  rawText: string,
  validAgentIds: string[]
): { success: true; decision: ModeratorDecision } | { success: false; error: string } {
  try {
    let clean = rawText.trim();
    // Strip markdown code fences if model returned ```json ... ```
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      clean = jsonMatch[0];
    }

    const parsed = JSON.parse(clean);

    if (typeof parsed !== 'object' || parsed === null) {
      return { success: false, error: 'Output is not a valid JSON object' };
    }

    const concluded = Boolean(parsed.concluded);
    const reason = typeof parsed.reason === 'string' ? parsed.reason.trim() : 'No reason provided';
    const nextSpeaker = typeof parsed.nextSpeaker === 'string' ? parsed.nextSpeaker.trim() : undefined;

    if (concluded) {
      return {
        success: true,
        decision: {
          concluded: true,
          nextSpeaker: undefined,
          reason: reason || 'Discussion completed by moderator decision',
        },
      };
    }

    if (!nextSpeaker || !validAgentIds.includes(nextSpeaker)) {
      return {
        success: false,
        error: `nextSpeaker '${nextSpeaker}' is not in valid participant IDs: [${validAgentIds.join(', ')}]`,
      };
    }

    return {
      success: true,
      decision: {
        concluded: false,
        nextSpeaker,
        reason,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: `JSON parse error: ${(err as Error).message}`,
    };
  }
}

export function buildModeratorRepairPrompt(
  invalidRaw: string,
  errorReason: string,
  validAgentIds: string[]
): string {
  return [
    `Your previous response could not be validated.`,
    `Error: ${errorReason}`,
    `Your previous output was:\n"""\n${invalidRaw.slice(0, 400)}\n"""`,
    `Valid participant IDs are: [${validAgentIds.map((id) => `"${id}"`).join(', ')}]`,
    `Please respond strictly with valid JSON:`,
    `{ "nextSpeaker": "<agent_id>", "concluded": false, "reason": "<reason>" }`,
  ].join('\n\n');
}

export function getDeterministicFallbackDecision(
  validAgentIds: string[],
  lastSpeakerId?: string,
  reason: string = 'Moderator output invalid; falling back to deterministic round-robin'
): ModeratorDecision {
  if (validAgentIds.length === 0) {
    return {
      concluded: true,
      reason: 'No available participants to select.',
    };
  }

  const lastIndex = lastSpeakerId ? validAgentIds.indexOf(lastSpeakerId) : -1;
  const nextIndex = (lastIndex + 1) % validAgentIds.length;
  const nextSpeaker = validAgentIds[nextIndex];

  return {
    nextSpeaker,
    concluded: false,
    reason,
  };
}
