import { useEffect, useRef, useState } from "react";
import type { ChatMessage, Player } from "@shared/types/game";

export interface ChatProps {
  messages: ChatMessage[];
  me: Player | null;
  disabled: boolean;
  onSend: (text: string) => void;
}

function ChatCollapseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M15 8v8M11 12l3-3-3-3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChatExpandIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M9 8v8M13 12l-3-3 3-3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Chat({ messages, me, disabled, onSend }: ChatProps) {
  const [text, setText] = useState("");
  const [expanded, setExpanded] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el || !expanded) return;
    el.scrollTop = el.scrollHeight;
  }, [messages?.length, expanded]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  }

  return (
    <aside
      className={`chat-panel ${expanded ? "" : "chat-panel--collapsed"}`.trim()}
      aria-label="Chat da mesa"
    >
      <header className="chat-head">
        <div className="chat-head-row">
          <button
            type="button"
            className="chat-toggle-btn"
            aria-label={expanded ? "Ocultar chat" : "Mostrar chat"}
            aria-expanded={expanded}
            onClick={() => setExpanded((open) => !open)}
          >
            {expanded ? <ChatCollapseIcon /> : <ChatExpandIcon />}
          </button>
          <h2>Chat</h2>
        </div>
        {expanded && <p>Conversa da mesa</p>}
      </header>

      {expanded && (
        <>
          <div className="chat-list" ref={listRef}>
            {(messages ?? []).length === 0 && (
              <p className="chat-empty">Nenhuma mensagem ainda.</p>
            )}
            {(messages ?? []).map((m) => (
              <div
                key={m.id}
                className={[
                  "chat-msg",
                  m.system ? "system" : "",
                  m.playerId === me?.id ? "mine" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {!m.system && <span className="chat-author">{m.playerName}</span>}
                <p>{m.text}</p>
              </div>
            ))}
          </div>

          <form className="chat-form" onSubmit={submit}>
            <input
              type="text"
              value={text}
              maxLength={280}
              placeholder={me ? "Escreva uma mensagem…" : "Entre na partida para falar"}
              disabled={disabled || !me}
              onChange={(e) => setText(e.target.value)}
            />
            <button
              type="submit"
              className="btn primary"
              disabled={disabled || !me || !text.trim()}
            >
              Enviar
            </button>
          </form>
        </>
      )}
    </aside>
  );
}
