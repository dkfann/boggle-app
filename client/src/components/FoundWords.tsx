import { memo } from 'react';
import type { FoundWord } from '../../../shared/src/protocol';

interface FoundWordsProps {
  words: FoundWord[];
}

function FoundWords({ words }: FoundWordsProps) {
  return (
    <section className="panel panel--grow">
      <header className="panel__header">
        <h2>Your words</h2>
        <span className="panel__note">{words.length}</span>
      </header>
      {words.length === 0 ? (
        <p className="empty">Nothing yet. Three letters or more.</p>
      ) : (
        <ul className="found">
          {words.map((entry) => (
            <li key={entry.word} className="found__row">
              <span>{entry.word}</span>
              <span className="found__score">+{entry.score}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default memo(FoundWords);
