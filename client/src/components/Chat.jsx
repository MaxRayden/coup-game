import { useEffect, useRef, useState } from "react";

export default function Chat({ messages, me, disabled, onSend }) {
  const [text, setText] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages?.length]);

  function submit(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend?.(trimmed);
    setText("");
  }

  return (
    <aside className="chat-panel" aria-label="Chat da mesa">
      <header className="chat-head">
        <h2>Chat</h2>
        <p>Conversa da mesa</p>
      </header>

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
    </aside>
  );
}
