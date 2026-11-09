import { useCallback, useState } from 'react';
import { api } from '../api.js';
import { Elapsed } from '../components/Tick.jsx';
import { formatDateTime, formatDuration, HELP_STATUS, HELP_TYPES } from '../format.js';
import { useSocket } from '../useSocket.js';

function AnnouncementCard({ announcement, onAcknowledge, reminded }) {
  const isCritical = announcement.priority === 'critical';
  const pendingAck = isCritical && !announcement.acknowledged_at;
  return (
    <article className={`card announcement ${pendingAck ? 'announcement-pending' : ''} ${reminded ? 'announcement-reminded' : ''}`}>
      <div className="row-between">
        <span className={`badge ${isCritical ? 'badge-critical' : 'badge-info'}`}>
          {isCritical ? 'Crítico' : 'Informativo'}
        </span>
        <span className="muted small">{announcement.author_name} · {formatDateTime(announcement.published_at)}</span>
      </div>
      <h3>{announcement.title}</h3>
      <p className="prewrap">{announcement.body}</p>
      {reminded && pendingAck && <p className="warning small">Recordatorio: este comunicado sigue sin confirmar.</p>}
      {announcement.acknowledged_at ? (
        <p className="success small">Confirmado el {formatDateTime(announcement.acknowledged_at)}</p>
      ) : (
        <button type="button" className={`button ${isCritical ? 'button-primary' : ''}`} onClick={() => onAcknowledge(announcement.id)}>
          Leí y entendí
        </button>
      )}
    </article>
  );
}

function HelpPanel({ requests, onCreate }) {
  const [type, setType] = useState('difficult_customer');
  const [summary, setSummary] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const active = requests.find((request) => request.status !== 'resolved');

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onCreate({ type, summary });
      setSummary('');
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>Levantar la mano</h2>
      {active ? (
        <div className={`help-status help-status-${active.status}`}>
          <strong>{HELP_STATUS[active.status]}</strong>
          <p>{HELP_TYPES[active.type]}: {active.summary}</p>
          {active.status === 'pending' ? (
            <p className="small">Esperando supervisor · <Elapsed since={active.created_at} /></p>
          ) : (
            <p className="small"><strong>{active.supervisor_name}</strong> tomó tu solicitud. Esperaste {formatDuration(active.wait_seconds)}.</p>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="stack">
          <label className="field">
            ¿Qué necesitas?
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {Object.entries(HELP_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="field">
            Resumen
            <textarea required maxLength={500} rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Cuéntale en una línea al supervisor qué pasa" />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" className="button button-primary" disabled={busy}>Solicitar ayuda</button>
        </form>
      )}
      {requests.some((request) => request.status === 'resolved') && (
        <>
          <h3 className="section-title">Resueltas hoy</h3>
          <ul className="plain-list small">
            {requests.filter((request) => request.status === 'resolved').slice(0, 5).map((request) => (
              <li key={request.id}>
                {HELP_TYPES[request.type]} · espera {formatDuration(request.wait_seconds)} · atención {formatDuration(request.resolution_seconds)}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function AgentView({ notify }) {
  const [announcements, setAnnouncements] = useState([]);
  const [requests, setRequests] = useState([]);
  const [reminded, setReminded] = useState(() => new Set());
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [announcementData, requestData] = await Promise.all([api('/announcements'), api('/help-requests')]);
      setAnnouncements(announcementData.announcements);
      setRequests(requestData.requests);
      setLoaded(true);
    } catch (failure) {
      notify(failure.message, 'error');
    }
  }, [notify]);

  const upsertRequest = (request) => {
    setRequests((current) => [request, ...current.filter((item) => item.id !== request.id)]);
  };

  const connected = useSocket(
    {
      'announcement:new': (announcement) => {
        setAnnouncements((current) => [announcement, ...current.filter((item) => item.id !== announcement.id)]);
        notify(`Nuevo comunicado: ${announcement.title}`, announcement.priority === 'critical' ? 'critical' : 'info');
      },
      'announcement:reminder': ({ announcementId, title }) => {
        setReminded((current) => new Set(current).add(announcementId));
        notify(`Recordatorio: confirma «${title}»`, 'critical');
      },
      'help:created': upsertRequest,
      'help:claimed': (request) => {
        upsertRequest(request);
        notify(`${request.supervisor_name} tomó tu solicitud`, 'success');
      },
      'help:resolved': (request) => {
        upsertRequest(request);
        notify('Tu solicitud quedó resuelta', 'success');
      },
    },
    reload,
  );

  async function acknowledge(id) {
    try {
      const { acknowledgedAt } = await api(`/announcements/${id}/ack`, { method: 'POST' });
      setAnnouncements((current) => current.map((item) => (
        item.id === id ? { ...item, acknowledged_at: acknowledgedAt } : item
      )));
    } catch (failure) {
      notify(failure.message, 'error');
    }
  }

  async function createRequest(input) {
    const { request } = await api('/help-requests', { method: 'POST', body: input });
    upsertRequest(request);
  }

  const pendingCount = announcements.filter((item) => item.priority === 'critical' && !item.acknowledged_at).length;

  return (
    <div className="columns columns-agent">
      <section className="stack">
        <div className="row-between">
          <h2>Comunicados {pendingCount > 0 && <span className="badge badge-critical">{pendingCount} por confirmar</span>}</h2>
          <ConnectionBadge connected={connected} />
        </div>
        {loaded && announcements.length === 0 && <p className="muted card">Aún no tienes comunicados.</p>}
        {announcements.map((announcement) => (
          <AnnouncementCard key={announcement.id} announcement={announcement} onAcknowledge={acknowledge} reminded={reminded.has(announcement.id)} />
        ))}
      </section>
      <HelpPanel requests={requests} onCreate={createRequest} />
    </div>
  );
}

export function ConnectionBadge({ connected }) {
  return (
    <span className={`connection ${connected ? 'connection-on' : 'connection-off'}`}>
      {connected ? 'En vivo' : 'Reconectando…'}
    </span>
  );
}
