import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { matches, SearchBox, SearchSelect } from '../components/SearchSelect.jsx';
import { ConnectionBadge, PageHeader, Shell } from '../components/Shell.jsx';
import { Elapsed } from '../components/Tick.jsx';
import { formatDateTime, formatDuration, HELP_STATUS, HELP_TYPES } from '../format.js';
import { navigate, useHashRoute } from '../router.js';
import { useSocket } from '../useSocket.js';

function HelpQueue({ requests, user, onClaim, onResolve }) {
  const open = requests.filter((request) => request.status !== 'resolved');
  const resolved = requests.filter((request) => request.status === 'resolved');
  return (
    <section className="card">
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
            {resolved.map((request) => (
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
  const [query, setQuery] = useState('');
  const [onlyOnline, setOnlyOnline] = useState(false);
  const visible = agents.filter((agent) => (!onlyOnline || agent.online) && matches(query, agent.full_name));
  return (
    <section className="card">
      <div className="toolbar">
        <SearchBox value={query} onChange={setQuery} placeholder="Buscar agente…" />
        <label className="checkbox">
          <input type="checkbox" checked={onlyOnline} onChange={(e) => setOnlyOnline(e.target.checked)} />
          Solo conectados
        </label>
      </div>
      {visible.length === 0 && <p className="muted">Ningún agente coincide.</p>}
      <ul className="presence">
        {visible.map((agent) => (
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

  const targetOptions = useMemo(() => {
    const campaignName = Object.fromEntries(directory.campaigns.map((item) => [item.id, item.name]));
    const teamName = Object.fromEntries(directory.teams.map((item) => [item.id, item.name]));
    return [
      ...directory.campaigns.map((item) => ({ value: `campaign:${item.id}`, label: item.name, group: 'Campañas' })),
      ...directory.teams.map((item) => ({ value: `team:${item.id}`, label: item.name, hint: campaignName[item.campaign_id], group: 'Equipos' })),
      ...directory.agents.map((item) => ({ value: `user:${item.id}`, label: item.full_name, hint: teamName[item.team_id], group: 'Agentes' })),
    ];
  }, [directory]);

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
      navigate('comunicados');
    } catch (failure) {
      notify(failure.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card form-narrow">
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
          <div className="field">
            <label htmlFor="announcement-target">Dirigido a</label>
            <SearchSelect
              id="announcement-target"
              required
              options={targetOptions}
              value={form.target}
              onChange={(target) => setForm((current) => ({ ...current, target }))}
              placeholder="Busca una campaña, equipo o agente…"
            />
          </div>
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
  const [query, setQuery] = useState('');
  const visible = announcements.filter((item) => matches(query, item.title));
  return (
    <section className="card">
      <div className="toolbar"><SearchBox value={query} onChange={setQuery} placeholder="Buscar por título…" /></div>
      {announcements.length === 0 && <p className="muted">Aún no hay comunicados.</p>}
      {announcements.length > 0 && visible.length === 0 && <p className="muted">Ningún comunicado coincide.</p>}
      <ul className="announcement-list">
        {visible.map((item) => {
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

export function SupervisorView({ user, notify, onLogout }) {
  const [pageId = 'cola', subPage] = useHashRoute();
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

  const pendingCount = requests.filter((item) => item.status === 'pending').length;
  const onlineCount = agents.filter((agent) => agent.online).length;
  const pages = [
    { id: 'cola', label: 'Cola de ayuda', section: 'Piso', badge: pendingCount, badgeTone: 'badge-warning' },
    { id: 'presencia', label: 'Presencia', section: 'Piso', badge: `${onlineCount}/${agents.length}` },
    { id: 'comunicados/nuevo', label: 'Nuevo comunicado', section: 'Comunicados' },
    { id: 'comunicados', label: 'Comunicados publicados', section: 'Comunicados' },
  ];
  const routeId = subPage ? `${pageId}/${subPage}` : pageId;
  const currentId = pages.some((page) => page.id === routeId) ? routeId : 'cola';

  const content = {
    cola: (
      <>
        <PageHeader title="Cola de ayuda" description={`${pendingCount} solicitud(es) en espera, ordenadas por prioridad.`} />
        <HelpQueue requests={requests} user={user} onClaim={claim} onResolve={resolve} />
      </>
    ),
    presencia: (
      <>
        <PageHeader title="Presencia" description={`${onlineCount} de ${agents.length} agentes conectados.`} />
        <Presence agents={agents} />
      </>
    ),
    'comunicados/nuevo': (
      <>
        <PageHeader title="Nuevo comunicado" description="Los comunicados críticos se recuerdan a quien no los haya confirmado." />
        <Composer directory={directory} onPublished={loadAnnouncements} notify={notify} />
      </>
    ),
    comunicados: (
      <>
        <PageHeader title="Comunicados publicados" description="Abre un comunicado para ver quién lo confirmó." />
        <Announcements
          announcements={announcements}
          statuses={statuses}
          expandedId={expandedId}
          onToggle={(id) => setExpandedId((current) => (current === id ? null : id))}
        />
      </>
    ),
  };

  return (
    <Shell user={user} onLogout={onLogout} pages={pages} currentId={currentId} status={<ConnectionBadge connected={connected} />}>
      {content[currentId]}
    </Shell>
  );
}
