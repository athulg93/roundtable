/**
 * Multi-Agent Group Chat - React Host Application (Phase 1 MVP)
 */

import { GroupChat } from '@/packages/ui-react/index.ts';

export default function App() {
  return (
    <main className="w-full h-screen bg-slate-950 font-sans antialiased text-slate-100">
      <GroupChat />
    </main>
  );
}
