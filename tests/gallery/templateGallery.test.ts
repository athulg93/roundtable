import { describe, it, expect } from 'vitest';
import { BUILT_IN_TEMPLATES } from '../../packages/gallery/templates.ts';
import { GalleryStorage } from '../../packages/gallery/galleryStorage.ts';

describe('Deliberation Template Gallery (Phase 3)', () => {
  it('provides comprehensive built-in templates with valid personas and protocols', () => {
    expect(BUILT_IN_TEMPLATES.length).toBeGreaterThanOrEqual(4);

    for (const tpl of BUILT_IN_TEMPLATES) {
      expect(tpl.id).toBeDefined();
      expect(tpl.title.length).toBeGreaterThan(5);
      expect(tpl.goal.length).toBeGreaterThan(10);
      expect(tpl.agents.length).toBeGreaterThanOrEqual(3);

      const hasModerator = tpl.agents.some((a) => a.role === 'moderator');
      expect(hasModerator).toBe(true);

      const hasParticipants = tpl.agents.filter((a) => a.role === 'participant').length >= 2;
      expect(hasParticipants).toBe(true);
    }
  });

  it('instantiates template into runnable Group and Agent records', () => {
    const storage = new GalleryStorage();
    const tpl = BUILT_IN_TEMPLATES[0];

    const { group, agents } = storage.instantiateTemplate(tpl);

    expect(group.id).toMatch(/^grp-/);
    expect(group.name).toBe(tpl.title);
    expect(group.goal).toBe(tpl.goal);
    expect(group.protocol).toBe(tpl.suggestedProtocol);
    expect(group.agentIds).toHaveLength(tpl.agents.length);
    expect(group.moderatorId).toBeDefined();

    for (const agentId of group.agentIds) {
      const agent = agents[agentId];
      expect(agent).toBeDefined();
      expect(agent.id).toBe(agentId);
      expect(agent.name).toBeDefined();
      expect(agent.contextBudget).toBeGreaterThan(0);
      expect(agent.visualIdentity.color).toBeDefined();
    }
  });

  it('exports template bundle to JSON and imports accurately', () => {
    const storage = new GalleryStorage();
    const json = storage.exportBundle([BUILT_IN_TEMPLATES[0]]);

    expect(json).toContain('Distributed Systems RFC');

    const imported = storage.importBundle(json);
    expect(imported).toHaveLength(1);
    expect(imported[0].title).toBe(BUILT_IN_TEMPLATES[0].title);
    expect(imported[0].isCustom).toBe(true);
  });
});
