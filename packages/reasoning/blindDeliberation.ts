/**
 * Blind-First Deliberation Engine (Phase 2 - P2.2)
 * Dispatches participant agents in parallel with epistemic isolation (zero peer bias),
 * then reconciles independent positions into the shared blackboard.
 */

import { Agent, Conversation, Usage } from '../core/types.ts';
import { GroupChatSession } from '../core/orchestrator.ts';
import { createBlackboardItem } from './blackboard.ts';

export interface BlindStance {
  agentId: string;
  agentName: string;
  content: string;
  usage?: Usage;
}

export async function executeBlindRound(
  session: GroupChatSession
): Promise<Record<string, BlindStance>> {
  const conv = session.conversation;
  const participants = Object.values(conv.agentSnapshots).filter(
    (a) => a.role === 'participant'
  );

  if (participants.length === 0) {
    throw new Error('No participant agents available for blind round');
  }

  // Phase A: Parallel independent generation with epistemic isolation
  const parallelTasks = participants.map(async (agent): Promise<BlindStance> => {
    // Build isolated context with blindMode: true (no prior peer turns)
    const context = session.contextBuilder.build(agent, conv, { blindMode: true });
    const adapter = session.providers.require(agent.provider);

    let content = '';
    let usage: Usage | undefined;

    for await (const chunk of adapter.generate({
      model: agent.model,
      systemPrompt: [
        context.systemPrompt,
        `CRITICAL BLIND ROUND INSTRUCTION: You are submitting an independent initial stance before consulting other participants. Provide your candid, uninfluenced technical position and key rationale.`,
      ].join('\n\n'),
      messages: [{ role: 'user', content: `Please provide your independent evaluation of the topic: "${conv.groupSnapshot.goal}"` }],
      temperature: agent.temperature,
      maxOutputTokens: agent.maxOutputTokens,
    })) {
      content += chunk.text;
      if (chunk.isFinal && chunk.usage) {
        usage = chunk.usage;
      }
    }

    return {
      agentId: agent.id,
      agentName: agent.name,
      content: content.trim(),
      usage,
    };
  });

  const stancesList = await Promise.all(parallelTasks);
  const stancesMap: Record<string, BlindStance> = {};

  for (const s of stancesList) {
    stancesMap[s.agentId] = s;
  }

  // Phase B: Publish blind round event to the durable log
  await (session as any).appendEvent({
    type: 'blind_round.completed',
    payload: {
      roundNumber: conv.roundCount + 1,
      stances: stancesMap,
    },
  });

  // Record individual turns in history
  for (const s of stancesList) {
    const turnId = 'turn-blind-' + Math.random().toString(36).substring(2, 7);
    await (session as any).appendEvent({
      type: 'turn.started',
      payload: {
        turnId,
        speakerId: s.agentId,
        speakerName: s.agentName,
        role: 'agent',
        model: conv.agentSnapshots[s.agentId]?.model || 'model',
        provider: conv.agentSnapshots[s.agentId]?.provider || 'mock',
        effectiveConfig: {
          temperature: conv.agentSnapshots[s.agentId]?.temperature ?? 0.7,
          maxOutputTokens: conv.agentSnapshots[s.agentId]?.maxOutputTokens ?? 1024,
          contextBudget: conv.agentSnapshots[s.agentId]?.contextBudget ?? 8192,
        },
      },
    });

    await (session as any).appendEvent({
      type: 'turn.completed',
      payload: {
        turnId,
        speakerId: s.agentId,
        content: `[Independent Blind Stance]:\n${s.content}`,
        usage: s.usage,
      },
    });

    // Populate initial hypothesis on blackboard
    const hypothesisText = s.content.slice(0, 160).replace(/\n/g, ' ');
    await (session as any).appendEvent({
      type: 'blackboard.item_added',
      payload: {
        item: createBlackboardItem(
          'hypothesis',
          `${s.agentName}'s proposed stance: ${hypothesisText}...`,
          s.agentId,
          s.agentName
        ),
      },
    });
  }

  return stancesMap;
}
