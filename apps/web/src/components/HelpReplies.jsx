import { useState } from 'react';
import { formatDateTime } from '../format.js';

// Conversación de una solicitud de ayuda entre el agente y el supervisor que la tomó.
export function HelpReplies({ replies, userId }) {
  if (!replies?.length) return null;
  return (
    <ul className="replies" aria-label="Conversación de la solicitud">
      {replies.map((reply) => {
        const own = reply.author_id === userId;
        return (
          <li key={reply.id} className={`reply ${own ? 'reply-own' : ''} reply-${reply.author_role}`}>
            <span className="small muted">{own ? 'Tú' : reply.author_name} · {formatDateTime(reply.created_at)}</span>
            <p className="prewrap">{reply.body}</p>
          </li>
        );
      })}
    </ul>
  );
}

export function ReplyForm({ onSend, label, placeholder }) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await onSend(body);
      setBody('');
    } catch {
      // El aviso de error lo muestra onSend; se conserva el texto para reintentar.
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack reply-form" onSubmit={submit}>
      <label className="field">
        {label}
        <textarea required maxLength={1000} rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder={placeholder} />
      </label>
      <button type="submit" className="button button-primary" disabled={busy}>Enviar mensaje</button>
    </form>
  );
}
