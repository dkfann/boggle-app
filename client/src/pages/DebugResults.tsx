import { useState } from 'react';
import Results from '../components/Results';
import type { ChatMessage } from '../../../shared/src/protocol';
import {
  DEBUG_BOARD,
  DEBUG_BOARD_WORDS,
  DEBUG_DURATION_MS,
  DEBUG_MODE,
  DEBUG_PLAYER_ID,
  DEBUG_RESULTS,
} from '../game/debugResultsFixture';

/**
 * `?debugResults=1` on any URL - see App.tsx. Renders the results screen
 * straight off fixture data, with no room, socket, or finished round needed,
 * so its layout/interactions can be iterated on without waiting out a timer
 * every time. Dev-only: stripped from production builds entirely.
 */
export default function DebugResults() {
  const [isReady, setIsReady] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  return (
    <main className="room">
      <Results
        results={DEBUG_RESULTS}
        boardWords={DEBUG_BOARD_WORDS}
        board={DEBUG_BOARD}
        playerId={DEBUG_PLAYER_ID}
        isHost={false}
        canPlayAgain={false}
        isReady={isReady}
        durationMs={DEBUG_DURATION_MS}
        mode={DEBUG_MODE}
        onReady={setIsReady}
        onPlayAgain={() => {}}
        onLeave={() => {
          window.location.href = '/';
        }}
        chatMessages={chatMessages}
        onSendChat={(text) =>
          setChatMessages((current) => [
            ...current,
            {
              id: `debug-${current.length}`,
              playerId: DEBUG_PLAYER_ID,
              playerName: 'You',
              text,
              sentAt: Date.now(),
            },
          ])
        }
      />
    </main>
  );
}
