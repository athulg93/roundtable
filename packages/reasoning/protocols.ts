/**
 * Deliberation Protocol Presets (Phase 2 - P2.4)
 * Drives specialized conversational rules for Debate, Red-Team, Pre-Mortem, and Delphi consensus.
 */

import { DeliberationProtocol, Agent, Turn } from '../core/types.ts';
import { GroupChatSession } from '../core/orchestrator.ts';
import { createBlackboardItem } from './blackboard.ts';

export interface ProtocolDefinition {
  id: DeliberationProtocol;
  name: string;
  description: string;
  rolesMap: Record<string, string>; // semantic role names
  determineNextSpeaker: (
    session: GroupChatSession,
    participants: Agent[]
  ) => { speakerId?: string; promptPrefix?: string; isConcluded?: boolean; conclusionReason?: string };
}

export const PROTOCOL_PRESETS: Record<DeliberationProtocol, ProtocolDefinition> = {
  standard: {
    id: 'standard',
    name: 'Standard Deliberation',
    description: 'Balanced open discussion orchestrated by the group speaker policy.',
    rolesMap: {},
    determineNextSpeaker: (_session, participants) => {
      return { speakerId: participants[0]?.id };
    },
  },

  'blind-first': {
    id: 'blind-first',
    name: 'Blind-First Delphi',
    description: 'Independent parallel stances before group debate to eliminate anchor bias.',
    rolesMap: {},
    determineNextSpeaker: (_session, participants) => {
      return { speakerId: participants[0]?.id };
    },
  },

  debate: {
    id: 'debate',
    name: 'Formal Debate',
    description: 'Strict adversarial dialectic: Affirmative argument, Negative rebuttal, Cross-examination, and Moderator verdict.',
    rolesMap: {
      affirmative: 'Proposes and defends the primary resolution',
      negative: 'Challenges assumptions and presents counter-arguments',
      moderator: 'Evaluates logical consistency and issues the final verdict',
    },
    determineNextSpeaker: (session, participants) => {
      const turns = session.conversation.turns.filter((t) => t.status === 'completed');
      const agentTurns = turns.filter((t) => t.role === 'agent' || t.role === 'moderator');
      const stepIndex = agentTurns.length;

      const affirmative = participants[0] || participants[0];
      const negative = participants[1] || participants[0];
      const moderatorId = session.conversation.groupSnapshot.moderatorId;

      switch (stepIndex) {
        case 0:
          return {
            speakerId: affirmative.id,
            promptPrefix: `[DEBATE PROTOCOL - ROUND 1: AFFIRMATIVE CONSTRUCTIVE]: Present your strongest evidence-backed arguments supporting the core proposition.`,
          };
        case 1:
          return {
            speakerId: negative.id,
            promptPrefix: `[DEBATE PROTOCOL - ROUND 2: NEGATIVE REBUTTAL]: Dissect the affirmative position, point out logical flaws, unverified assumptions, and counter-evidence.`,
          };
        case 2:
          return {
            speakerId: affirmative.id,
            promptPrefix: `[DEBATE PROTOCOL - ROUND 3: AFFIRMATIVE DEFENSE]: Defend against the negative rebuttal and clarify the most robust aspects of your proposal.`,
          };
        case 3:
          return {
            speakerId: negative.id,
            promptPrefix: `[DEBATE PROTOCOL - ROUND 4: NEGATIVE SUMMARY]: Deliver your closing objections and state why the proposal remains insufficient.`,
          };
        default:
          return {
            speakerId: moderatorId,
            isConcluded: true,
            conclusionReason: `Debate protocol completed: Affirmative and Negative arguments have concluded. Moderator verdict issued.`,
          };
      }
    },
  },

  'red-team': {
    id: 'red-team',
    name: 'Adversarial Red-Team',
    description: 'Rigorous threat modeling: Architecture Proposal -> Red-Team Exploit -> Blue-Team Defense -> Security Arbiter.',
    rolesMap: {
      architect: 'Proposes baseline architecture and operational mechanisms',
      red_team: 'Identifies exploit vectors, single points of failure, and security flaws',
      blue_team: 'Formulates concrete patches, mitigations, and defensive barriers',
      arbiter: 'Issues risk assessment and final operational approval',
    },
    determineNextSpeaker: (session, participants) => {
      const turns = session.conversation.turns.filter((t) => t.status === 'completed');
      const stepIndex = turns.length;

      const architect = participants[0];
      const redTeam = participants[1] || participants[0];
      const blueTeam = participants[2] || participants[0];
      const arbiterId = session.conversation.groupSnapshot.moderatorId;

      switch (stepIndex) {
        case 0:
          return {
            speakerId: architect.id,
            promptPrefix: `[RED-TEAM PROTOCOL - PHASE 1: SYSTEM PROPOSAL]: Detail the intended architecture, data flows, and operational assumptions.`,
          };
        case 1:
          return {
            speakerId: redTeam.id,
            promptPrefix: `[RED-TEAM PROTOCOL - PHASE 2: ADVERSARIAL ATTACK]: Identify critical vulnerabilities, privilege escalations, edge cases, and attack vectors against this design.`,
          };
        case 2:
          return {
            speakerId: blueTeam.id,
            promptPrefix: `[RED-TEAM PROTOCOL - PHASE 3: DEFENSIVE HARDENING]: Provide actionable defensive countermeasures, compartmentalization, and validation checks to defeat the attack vectors.`,
          };
        default:
          return {
            speakerId: arbiterId,
            isConcluded: stepIndex >= 4,
            conclusionReason: `Security Arbiter has evaluated red-team findings and blue-team mitigations. Final security posture established.`,
          };
      }
    },
  },

  'pre-mortem': {
    id: 'pre-mortem',
    name: 'Pre-Mortem Failure Analysis',
    description: 'Assume catastrophic failure in 6 months. Identify root causes and formulate preemptive mitigations.',
    rolesMap: {
      diagnostician: 'Identifies failure manifestations and timeline breakdown',
      root_cause: 'Uncovers latent technical and organizational causes',
      preventer: 'Designs proactive failsafes and rollback boundaries',
    },
    determineNextSpeaker: (session, participants) => {
      const turns = session.conversation.turns.filter((t) => t.status === 'completed');
      const stepIndex = turns.length;

      const diagnostician = participants[0];
      const investigator = participants[1] || participants[0];
      const preventer = participants[2] || participants[0];

      switch (stepIndex) {
        case 0:
          return {
            speakerId: diagnostician.id,
            promptPrefix: `[PRE-MORTEM - HYPOTHETICAL FAILURE]: Imagine it is 6 months from now and our system suffered a catastrophic production outage. Describe specifically what broke and how the failure manifested.`,
          };
        case 1:
          return {
            speakerId: investigator.id,
            promptPrefix: `[PRE-MORTEM - ROOT CAUSE INQUEST]: Explain the underlying architectural oversights, resource bottlenecks, or invalid assumptions that led directly to that failure.`,
          };
        case 2:
          return {
            speakerId: preventer.id,
            promptPrefix: `[PRE-MORTEM - PREEMPTIVE SAFEGUARDS]: What specific structural checks, circuit breakers, and monitoring boundaries must we build today so this failure is impossible?`,
          };
        default:
          return {
            speakerId: session.conversation.groupSnapshot.moderatorId,
            isConcluded: true,
            conclusionReason: `Pre-mortem analysis complete: Root causes diagnosed and preventive safeguards recorded on Blackboard.`,
          };
      }
    },
  },
};
