import { memo, useEffect, useRef, useState, type FormEvent } from 'react';
import type { ChatMessage } from '../../../shared/src/protocol';

interface ChatProps {
  messages: ChatMessage[];
  playerId: string;
  onSend: (text: string) => void;
}

const MAX_CHAT_LENGTH = 300;

function Chat({ messages, playerId, onSend }: ChatProps) {
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLUListElement>(null);

  // Follow new messages, but only if you were already near the bottom - so
  // reading back through history doesn't get yanked away by an incoming one.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    if (nearBottom) list.scrollTop = list.scrollHeight;
  }, [messages.length]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft('');
  };

  return (
    <section className="panel chat">
      <header className="panel__header">
        <h2>Chat</h2>
        <span className="panel__note">{messages.length}</span>
      </header>

      {messages.length === 0 ? (
        <p className="empty">No messages yet. Say hi.</p>
      ) : (
        <ul className="chat__list" ref={listRef}>
          {messages.map((message) => (
            <li
              key={message.id}
              className={`chat__row${message.playerId === playerId ? ' chat__row--you' : ''}`}
            >
              <span className="chat__sender">{message.playerName}</span>
              <span className="chat__text">{message.text}</span>
            </li>
          ))}
        </ul>
      )}

      <form className="chat__form" onSubmit={submit}>
        <input
          className="field__input chat__input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Send a message"
          maxLength={MAX_CHAT_LENGTH}
          autoComplete="off"
        />
        <button type="submit" className="button" disabled={!draft.trim()}>
          Send
        </button>
      </form>
    </section>
  );
}

export default memo(Chat);
