/**
 * Deliberation Speech Synthesis Engine (Phase 3)
 * Provides distinct voices, pitch, and playback cadence for each agent
 * using the standard browser SpeechSynthesis API.
 */

import { Agent } from '../core/types.ts';

export class DeliberationVoiceEngine {
  private isVoiceEnabled = false;
  private currentSpeakerName: string | null = null;

  get enabled(): boolean {
    return this.isVoiceEnabled;
  }

  set enabled(val: boolean) {
    this.isVoiceEnabled = val;
    if (!val) {
      this.stop();
    }
  }

  get activeSpeaker(): string | null {
    return this.currentSpeakerName;
  }

  isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  speak(text: string, agent?: Partial<Agent>): void {
    if (!this.isVoiceEnabled || !this.isSupported()) return;

    this.stop();

    // Strip tool call markers or markdown code blocks for clean listening
    const cleanText = text
      .replace(/\[(?:ToolCall|Decision|Hypothesis|Assumption|Question|Objection):[\s\S]*?\]/gi, '')
      .replace(/```[\s\S]*?```/g, 'Code block omitted.')
      .slice(0, 500); // Read first paragraph for crisp cadence

    if (!cleanText.trim()) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);

    // Compute distinct pitch based on agent role and ID
    if (agent?.role === 'moderator') {
      utterance.pitch = 0.95;
      utterance.rate = 1.05;
    } else {
      const hash = (agent?.name || 'agent').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
      utterance.pitch = 0.85 + (hash % 5) * 0.1; // 0.85 to 1.25
      utterance.rate = 1.0 + (hash % 3) * 0.05;
    }

    this.currentSpeakerName = agent?.name || null;
    utterance.onend = () => {
      this.currentSpeakerName = null;
    };
    utterance.onerror = () => {
      this.currentSpeakerName = null;
    };

    window.speechSynthesis.speak(utterance);
  }

  stop(): void {
    if (this.isSupported()) {
      window.speechSynthesis.cancel();
      this.currentSpeakerName = null;
    }
  }
}

export const defaultVoiceEngine = new DeliberationVoiceEngine();
