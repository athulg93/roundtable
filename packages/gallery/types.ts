/**
 * Deliberation Template Gallery Domain Types (Phase 3)
 */

import { Agent, DeliberationProtocol, SpeakerSelectionPolicy, TerminationPolicy } from '../core/types.ts';

export type TemplateCategory =
  | 'architecture'
  | 'security'
  | 'reliability'
  | 'strategy'
  | 'code_review';

export interface DeliberationTemplate {
  id: string;
  title: string;
  description: string;
  category: TemplateCategory;
  tags: string[];
  goal: string;
  suggestedProtocol: DeliberationProtocol;
  speakerPolicy: SpeakerSelectionPolicy;
  terminationPolicy: TerminationPolicy;
  maxRounds: number;
  agents: Array<Omit<Agent, 'id'> & { id?: string }>;
  isCustom?: boolean;
}

export interface TemplateBundle {
  schemaVersion: 1;
  exportedAt: number;
  templates: DeliberationTemplate[];
}
