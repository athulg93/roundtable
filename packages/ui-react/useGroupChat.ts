/**
 * useGroupChat Hook (P1.10)
 * Connects React components to the headless GroupChatSession engine.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Conversation,
  ConversationEvent,
  ConversationState,
  RunOptions,
  Turn,
  NextStepsSummary,
  DetailedSummary,
} from '../core/types.ts';
import { GroupChatSession } from '../core/orchestrator.ts';

export interface UseGroupChatReturn {
  session: GroupChatSession;
  conversation: Conversation;
  state: ConversationState;
  events: ConversationEvent[];
  streamingTurnId: string | null;
  streamingContent: string;
  moderatorNote: string | null;
  isRunning: boolean;
  isPaused: boolean;
  isEnded: boolean;
  start: () => Promise<void>;
  step: (agentId?: string, options?: RunOptions) => Promise<Turn | null>;
  run: (options?: RunOptions) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: (reason?: string) => void;
  interject: (text: string, senderName?: string) => Promise<void>;
  summarize: () => Promise<{ nextSteps: NextStepsSummary; detailed: DetailedSummary }>;
}

export function useGroupChat(session: GroupChatSession): UseGroupChatReturn {
  const [conversation, setConversation] = useState<Conversation>(session.conversation);
  const [streamingTurnId, setStreamingTurnId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [moderatorNote, setModeratorNote] = useState<string | null>(null);

  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    setConversation(session.conversation);

    const unsubState = session.on('stateChange', (newConv: Conversation) => {
      setConversation({ ...newConv });
    });

    const unsubTurnStarted = session.on('turn.started', (event: any) => {
      setStreamingTurnId(event.payload.turnId);
      setStreamingContent('');
    });

    const unsubToken = session.on('token', (data: { turnId: string; chunk: string; fullText: string }) => {
      setStreamingTurnId(data.turnId);
      setStreamingContent(data.fullText);
    });

    const unsubTurnCompleted = session.on('turn.completed', () => {
      setStreamingTurnId(null);
      setStreamingContent('');
    });

    const unsubTurnFailed = session.on('turn.failed', () => {
      setStreamingTurnId(null);
      setStreamingContent('');
    });

    const unsubTurnSkipped = session.on('turn.skipped', () => {
      setStreamingTurnId(null);
      setStreamingContent('');
    });

    const unsubModeratorNote = session.on('moderatorNote', (data: { speakerId: string; note: string }) => {
      setModeratorNote(data.note);
    });

    return () => {
      unsubState();
      unsubTurnStarted();
      unsubToken();
      unsubTurnCompleted();
      unsubTurnFailed();
      unsubTurnSkipped();
      unsubModeratorNote();
    };
  }, [session]);

  const start = useCallback(() => sessionRef.current.start(), []);
  const step = useCallback(
    (agentId?: string, options?: RunOptions) => sessionRef.current.step(agentId, options),
    []
  );
  const run = useCallback(
    (options?: RunOptions) => sessionRef.current.run(options),
    []
  );
  const pause = useCallback(() => sessionRef.current.pause(), []);
  const resume = useCallback(() => sessionRef.current.resume(), []);
  const stop = useCallback((reason?: string) => sessionRef.current.stop(reason), []);
  const interject = useCallback(
    (text: string, senderName?: string) => sessionRef.current.interject(text, senderName),
    []
  );
  const summarize = useCallback(() => sessionRef.current.summarize(), []);

  return {
    session,
    conversation,
    state: conversation.state,
    events: conversation.events,
    streamingTurnId,
    streamingContent,
    moderatorNote,
    isRunning: conversation.state === 'running',
    isPaused: conversation.state === 'paused',
    isEnded: conversation.state === 'ended',
    start,
    step,
    run,
    pause,
    resume,
    stop,
    interject,
    summarize,
  };
}
