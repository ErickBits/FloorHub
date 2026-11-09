import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { Elapsed } from '../components/Tick.jsx';
import { formatDateTime, formatDuration, HELP_STATUS, HELP_TYPES } from '../format.js';
import { useSocket } from '../useSocket.js';
import { ConnectionBadge } from './AgentView.jsx';

function HelpQueue({ requests, user, onClaim, onResolve }) {
  const open = requests.filter((request) => request.status !== 'resolved');
  const resolved = requests.filter((request) => request.status === 'resolved');
  return (
    <section className="card">
      <h2>Cola de ayuda <span className="badge">{open.filter((item) => item.status === 'pending').length} en espera</span></h2>
      {open.length === 0 && <p className="muted">No hay solicitudes abiertas.</p>}
      <ul className="queue">
        {open.map((request) => (
          <li key={request.id} className={`queue-item queue-priority-${request.priority}`}>
            <div className="row-between">
              <strong>{request.agent_name}</strong>
              <span className="badge">{HELP_STATUS[request.status]}</span>
            </div>
            <div className="small muted">{HELP_TYPES[request.type]}</div>
            <p>{request.summary}</p>
            <div className="row-between">
              <span className="small muted">
                {request.status === 'pending' ? <>Esperando <Elapsed since={request.created_at} /></> : <>Atiende {request.supervisor_name}</>}
              </span>
              {request.status === 'pending' && (
                <button type="button" className="button button-primary" onClick={() => onClaim(request.id)}>Tomar</button>
              )}
              {request.status === 'in_progress' && request.claimed_by === user.id && (
                <button type="button" className="button" onClick={() => onResolve(request.id)}>Resolver</button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {resolved.length > 0 && (
        <>
          <h3 className="section-title">Resueltas (24 h)</h3>
          <ul className="plain-list small">
            {resolved.slice(0, 5).map((request) => (
              <li key={request.id}>
                {request.agent_name} · espera {formatDuration(request.wait_seconds)} · atención {formatDuration(request.resolution_seconds)}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Presence({ agents }) {
  const online = agents.filter((agent) => agent.online).length;
  return (
    <section className="card">
      <h2>Presencia <span className="badge">{online} de {agents.length}</span></h2>
      <ul className="presence">
        {agents.map((agent) => (
          <li key={agent.id}>
            <span className={`dot ${agent.online ? 'dot-on' : 'dot-off'}`} aria-hidden="true" />
            {agent.full_name}
            <span className="sr-only">{agent.online ? ' (conectado)' : ' (desconectado)'}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Composer({ directory, onPublished, notify }) {
  const empty = { title: '', body: '', priority: 'info', reminderIntervalMinutes: 5, target: '' };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  async function submit(event) {
    event.preventDefault();
    const [kind, id] = form.target.split(':');
    const targets = { campaignIds: [], teamIds: [], userIds: [] };
    targets[`${kind}Ids`] = [id];
    setBusy(true);
    try {
      await api('/announcements', {
        method: 'POST',
        body: {
          title: form.title,
          body: form.body,
          priority: form.priority,
          targets,
          ...(form.priority === 'critical' ? { reminderIntervalMinutes: Number(form.reminderIntervalMinutes) } : {}),
        },
      });
      setForm(empty);
      notify('Comunicado publicado', 'success');
      onPublished();
    } catch (failure) {
      notify(failure.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>Nuevo comunicado</h2>
      <form className="stack" onSubmit={submit}>
        <label className="field">
          Título
          <input required maxLength={200} value={form.title} onChange={set('title')} />
        </label>
        <label className="field">
          Mensaje
          <textarea required maxLength={5000} rows={3} value={form.body} onChange={set('body')} />
        </label>
        <div className="form-row">
          <label className="field">
            Dirigido a
            <select required value={form.target} onChange={set('target')}>
              <option value="" disabled>Elige un destino</option>
              <optgroup label="Campañas">
                {directory.campaigns.map((item) => <option key={item.id} value={`campaign:${item.id}`}>{item.name}</option>)}
              </optgroup>
              <optgroup label="Equipos">
                {directory.teams.map((item) => <option key={item.id} value={`team:${item.id}`}>{item.name}</option>)}
              </optgroup>
              <optgroup label="Agentes">
                {directory.agents.map((item) => <option key={item.id} value={`user:${item.id}`}>{item.full_name}</option>)}
              </optgroup>
            </select>
          </label>
          <label className="field">
            Prioridad
            <select value={form.priority} onChange={set('priority')}>
              <option value="info">Informativo</option>
              <option value="critical">Crítico</option>
            </select>
          </label>
          {form.priority === 'critical' && (
            <label className="field">
              Recordar cada (min)
              <input type="number" min={1} max={240} required value={form.reminderIntervalMinutes} onChange={set('reminderIntervalMinutes')} />
            </label>
          )}
        </div>
        <button type="submit" className="button button-primary" disabled={busy}>Publicar</button>
      </form>
    </section>
  );
}

function AnnouncementStatus({ status }) {
  return (
    <div className="status-detail">
      <div className="progress" role="progressbar" aria-valuenow={status.percent} aria-valuemin={0} aria-valuemax={100}>
        <div className="progress-bar" style={{ width: `${status.percent}%` }} />
      </div>
      <div className="two-lists">
        <div>
          <h4>Sin confirmar ({status.pending.length})</h4>
          <ul className="plain-list small">
            {status.pending.map((person) => (
              <li key={person.id}>
                {person.full_name}
                {person.reminder_count > 0 && <span className="muted"> · {person.reminder_count} recordatorio(s)</span>}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4>Confirmaron ({status.acknowledged.length})</h4>
          <ul className="plain-list small">
            {status.acknowledged.map((person) => (
              <li key={person.id}>{person.full_name} <span className="muted">· {formatDateTime(person.acknowledged_at)}</span></li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Announcements({ announcements, statuses, expandedId, onToggle }) {
  return (
    <section className="card">
      <h2>Comunicados publicados</h2>
      {announcements.length === 0 && <p className="muted">Aún no hay comunicados.</p>}
      <ul className="announcement-list">
        {announcements.map((item) => {
          const status = statuses[item.id];
          const total = status?.total ?? item.recipients_count;
          const acknowledged = status?.acknowledgedCount ?? item.acks_count;
          const percent = status?.percent ?? (total === 0 ? 0 : Math.round((acknowledged / total) * 100));
          return (
            <li key={item.id}>
              <button type="button" className="announcement-row" aria-expanded={expandedId === item.id} onClick={() => onToggle(item.id)}>
                <span className={`badge ${item.priority === 'critical' ? 'badge-critical' : 'badge-info'}`}>
                  {item.priority === 'critical' ? 'Crítico' : 'Info'}
                </span>
                <span className="announcement-title">{item.title}</span>
                <span className="tabular"><strong>{percent}%</strong> · {acknowledged}/{total}</span>
              </button>
              {expandedId === item.id && status && <AnnouncementStatus status={status} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function SupervisorView({ user, notify }) {
  const [directory, setDirectory] = useState({ campaigns: [], teams: [], agents: [] });
  const [requests, setRequests] = useState([]);
  const [agents, setAgents] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [expandedId, setExpandedId] = useState(null);

  const loadAnnouncements = useCallback(async () => {
    const { announcements: list } = await api('/announcements');
    setAnnouncements(list);
  }, []);

  const loadStatus = useCallback(async (id) => {
    const { status } = await api(`/announcements/${id}/status`);
    setStatuses((current) => ({ ...current, [id]: status }));
  }, []);

  const reload = useCallback(async () => {
    try {
      const [help, presence, directoryData] = await Promise.all([
        api('/help-requests'), api('/presence'), api('/directory'), loadAnnouncements(),
      ]);
      setRequests(help.requests);
      setAgents(presence.agents);
      setDirectory(directoryData);
    } catch (failure) {
      notify(failure.message, 'error');
    }
  }, [loadAnnouncements, notify]);

  const refreshQueue = useCallback(() => {
    api('/help-requests').then((data) => setRequests(data.requests)).catch(() => {});
  }, []);

  const connected = useSocket(
    {
      'help:created': (request) => {
        refreshQueue();
        notify(`${request.agent_name} levantó la mano`, 'info');
      },
      'help:claimed': refreshQueue,
      'help:resolved': refreshQueue,
      'presence:changed': ({ userId, online }) => {
        setAgents((current) => current.map((agent) => (agent.id === userId ? { ...agent, online } : agent)));
      },
      'announcement:published': () => {
        loadAnnouncements().catch(() => {});
      },
      'announcement:acknowledged': ({ announcementId }) => {
        // Se actualizan el total de la lista y, si está abierto, el detalle.
        loadStatus(announcementId).catch(() => {});
        loadAnnouncements().catch(() => {});
      },
    },
    reload,
  );

  useEffect(() => {
    if (expandedId) loadStatus(expandedId).catch((failure) => notify(failure.message, 'error'));
  }, [expandedId, loadStatus, notify]);

  async function claim(id) {
    try {
      await api(`/help-requests/${id}/claim`, { method: 'POST' });
    } catch (failure) {
      notify(failure.message, failure.status === 409 ? 'warning' : 'error');
    }
    refreshQueue();
  }

  async function resolve(id) {
    try {
      await api(`/help-requests/${id}/resolve`, { method: 'POST' });
    } catch (failure) {
      notify(failure.message, 'error');
    }
    refreshQueue();
  }

  return (
    <>
      <div className="row-between page-header">
        <h1>Piso de operaciones</h1>
        <ConnectionBadge connected={connected} />
      </div>
      <div className="columns columns-supervisor">
        <div className="stack">
          <HelpQueue requests={requests} user={user} onClaim={claim} onResolve={resolve} />
          <Presence agents={agents} />
        </div>
        <div className="stack">
          <Composer directory={directory} onPublished={loadAnnouncements} notify={notify} />
          <Announcements
            announcements={announcements}
            statuses={statuses}
            expandedId={expandedId}
            onToggle={(id) => setExpandedId((current) => (current === id ? null : id))}
          />
        </div>
      </div>
    </>
  );
}
