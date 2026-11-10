import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { matches, SearchBox, SearchSelect } from '../components/SearchSelect.jsx';
import { PageHeader, Shell } from '../components/Shell.jsx';
import { ROLE_LABELS } from '../format.js';
import { href, navigate, useHashRoute } from '../router.js';

const PAGES = [
  { id: 'usuarios', label: 'Listado de usuarios', section: 'Usuarios' },
  { id: 'usuarios/nuevo', label: 'Agregar usuario', section: 'Usuarios' },
  { id: 'campanas', label: 'Listado de campañas', section: 'Campañas' },
  { id: 'campanas/nueva', label: 'Agregar campaña', section: 'Campañas' },
  { id: 'equipos', label: 'Listado de equipos', section: 'Equipos' },
  { id: 'equipos/nuevo', label: 'Agregar equipo', section: 'Equipos' },
];

const NEW_PAGES = { usuarios: 'nuevo', campanas: 'nueva', equipos: 'nuevo' };

const teamOptions = (teams) => teams.map((team) => ({
  value: team.id, label: team.name, hint: team.campaign_name, group: team.campaign_name,
}));

function StatusPill({ active }) {
  return <span className={`badge ${active ? 'badge-success' : ''}`}>{active ? 'Activo' : 'Inactivo'}</span>;
}

function NotFound({ what, back }) {
  return (
    <section className="card stack">
      <p className="muted">No se encontró {what}.</p>
      <a className="button" href={href(back)}>Volver al listado</a>
    </section>
  );
}

// ---------- Usuarios ----------

function UserList({ users }) {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const visible = users.filter((user) => (!role || user.role === role)
    && matches(query, user.full_name, user.email, user.team_name));

  return (
    <>
      <PageHeader
        title="Usuarios"
        description={`${users.length} usuarios registrados`}
        actions={<a className="button button-primary" href={href('usuarios/nuevo')}>Agregar usuario</a>}
      />
      <section className="card">
        <div className="toolbar">
          <SearchBox value={query} onChange={setQuery} placeholder="Buscar por nombre, correo o equipo…" />
          <select aria-label="Filtrar por rol" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">Todos los roles</option>
            {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Equipo</th><th>Estado</th><th /></tr>
            </thead>
            <tbody>
              {visible.map((user) => (
                <tr key={user.id} className={user.is_active ? '' : 'row-inactive'}>
                  <td>{user.full_name}</td>
                  <td className="muted">{user.email}</td>
                  <td>{ROLE_LABELS[user.role]}</td>
                  <td>{user.team_name ?? '—'}</td>
                  <td><StatusPill active={user.is_active} /></td>
                  <td className="cell-actions"><a className="button button-ghost" href={href(`usuarios/${user.id}`)}>Editar</a></td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 && <p className="muted empty">Ningún usuario coincide con la búsqueda.</p>}
        </div>
      </section>
    </>
  );
}

function RoleAndTeamFields({ form, setField, teams }) {
  return (
    <div className="form-row">
      <label className="field">
        Rol
        <select value={form.role} onChange={(e) => setField('role', e.target.value)}>
          {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      {form.role === 'agent' ? (
        <div className="field">
          <label htmlFor="user-team">Equipo</label>
          <SearchSelect id="user-team" required options={teamOptions(teams)} value={form.teamId} onChange={(value) => setField('teamId', value)} placeholder="Busca un equipo…" />
        </div>
      ) : (
        <p className="field-note muted small">
          {form.role === 'supervisor' ? 'Los supervisores se asignan a equipos desde la página del equipo.' : 'Los administradores no pertenecen a ningún equipo.'}
        </p>
      )}
    </div>
  );
}

function UserCreate({ teams, run }) {
  const [form, setForm] = useState({ fullName: '', email: '', password: '', role: 'agent', teamId: '' });
  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  async function submit(event) {
    event.preventDefault();
    const body = { ...form, teamId: form.role === 'agent' ? form.teamId : null };
    if (await run(() => api('/admin/users', { method: 'POST', body }), 'Usuario creado')) navigate('usuarios');
  }

  return (
    <>
      <PageHeader title="Agregar usuario" description="La persona entra con este correo y contraseña." />
      <form className="card stack form-narrow" onSubmit={submit}>
        <div className="form-row">
          <label className="field">Nombre completo<input required maxLength={120} value={form.fullName} onChange={(e) => setField('fullName', e.target.value)} /></label>
          <label className="field">Correo<input required type="email" placeholder="nombre.apellido@floorhub.com" value={form.email} onChange={(e) => setField('email', e.target.value)} /></label>
        </div>
        <label className="field">
          Contraseña inicial
          <input required type="password" minLength={8} maxLength={72} autoComplete="new-password" value={form.password} onChange={(e) => setField('password', e.target.value)} />
          <span className="field-hint">Mínimo 8 caracteres.</span>
        </label>
        <RoleAndTeamFields form={form} setField={setField} teams={teams} />
        <div className="form-actions">
          <a className="button" href={href('usuarios')}>Cancelar</a>
          <button type="submit" className="button button-primary">Crear usuario</button>
        </div>
      </form>
    </>
  );
}

function UserEdit({ user, teams, run }) {
  const [form, setForm] = useState({
    fullName: user.full_name, role: user.role, teamId: user.team_id ?? '', isActive: user.is_active, password: '',
  });
  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  async function submit(event) {
    event.preventDefault();
    const body = {
      fullName: form.fullName,
      role: form.role,
      teamId: form.role === 'agent' ? form.teamId : null,
      isActive: form.isActive,
      ...(form.password ? { password: form.password } : {}),
    };
    if (await run(() => api(`/admin/users/${user.id}`, { method: 'PATCH', body }), 'Usuario actualizado')) navigate('usuarios');
  }

  return (
    <>
      <PageHeader title="Editar usuario" description={user.email} />
      <form className="card stack form-narrow" onSubmit={submit}>
        <div className="form-row">
          <label className="field">Nombre completo<input required maxLength={120} value={form.fullName} onChange={(e) => setField('fullName', e.target.value)} /></label>
          <label className="field">Correo<input value={user.email} disabled /></label>
        </div>
        <RoleAndTeamFields form={form} setField={setField} teams={teams} />
        <label className="field">
          Nueva contraseña
          <input type="password" minLength={8} maxLength={72} autoComplete="new-password" placeholder="Déjala vacía para no cambiarla" value={form.password} onChange={(e) => setField('password', e.target.value)} />
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={form.isActive} onChange={(e) => setField('isActive', e.target.checked)} />
          Usuario activo (si lo desactivas, no podrá iniciar sesión)
        </label>
        <div className="form-actions">
          <a className="button" href={href('usuarios')}>Cancelar</a>
          <button type="submit" className="button button-primary">Guardar cambios</button>
        </div>
      </form>
    </>
  );
}

// ---------- Campañas ----------

function CampaignList({ campaigns, teams }) {
  const [query, setQuery] = useState('');
  const visible = campaigns.filter((campaign) => matches(query, campaign.name));
  const teamCount = (id) => teams.filter((team) => team.campaign_id === id).length;

  return (
    <>
      <PageHeader
        title="Campañas"
        description={`${campaigns.length} campañas`}
        actions={<a className="button button-primary" href={href('campanas/nueva')}>Agregar campaña</a>}
      />
      <section className="card">
        <div className="toolbar"><SearchBox value={query} onChange={setQuery} placeholder="Buscar campaña…" /></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nombre</th><th>Equipos</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {visible.map((campaign) => (
                <tr key={campaign.id} className={campaign.is_active ? '' : 'row-inactive'}>
                  <td>{campaign.name}</td>
                  <td className="tabular">{teamCount(campaign.id)}</td>
                  <td><StatusPill active={campaign.is_active} /></td>
                  <td className="cell-actions"><a className="button button-ghost" href={href(`campanas/${campaign.id}`)}>Editar</a></td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 && <p className="muted empty">Ninguna campaña coincide con la búsqueda.</p>}
        </div>
      </section>
    </>
  );
}

function CampaignForm({ campaign, run }) {
  const [name, setName] = useState(campaign?.name ?? '');
  const [isActive, setIsActive] = useState(campaign?.is_active ?? true);

  async function submit(event) {
    event.preventDefault();
    const request = campaign
      ? () => api(`/admin/campaigns/${campaign.id}`, { method: 'PATCH', body: { name, isActive } })
      : () => api('/admin/campaigns', { method: 'POST', body: { name } });
    if (await run(request, campaign ? 'Campaña actualizada' : 'Campaña creada')) navigate('campanas');
  }

  return (
    <>
      <PageHeader title={campaign ? 'Editar campaña' : 'Agregar campaña'} description="Una campaña agrupa los equipos que atienden a un mismo cliente." />
      <form className="card stack form-narrow" onSubmit={submit}>
        <label className="field">Nombre<input required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></label>
        {campaign && (
          <label className="checkbox">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Campaña activa
          </label>
        )}
        <div className="form-actions">
          <a className="button" href={href('campanas')}>Cancelar</a>
          <button type="submit" className="button button-primary">{campaign ? 'Guardar cambios' : 'Crear campaña'}</button>
        </div>
      </form>
    </>
  );
}

// ---------- Equipos ----------

function TeamList({ teams, users }) {
  const [query, setQuery] = useState('');
  const visible = teams.filter((team) => matches(query, team.name, team.campaign_name, ...team.supervisors.map((s) => s.full_name)));
  const agentCount = (id) => users.filter((user) => user.team_id === id).length;

  return (
    <>
      <PageHeader
        title="Equipos"
        description={`${teams.length} equipos`}
        actions={<a className="button button-primary" href={href('equipos/nuevo')}>Agregar equipo</a>}
      />
      <section className="card">
        <div className="toolbar"><SearchBox value={query} onChange={setQuery} placeholder="Buscar por equipo, campaña o supervisor…" /></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Equipo</th><th>Campaña</th><th>Supervisores</th><th>Agentes</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {visible.map((team) => (
                <tr key={team.id} className={team.is_active ? '' : 'row-inactive'}>
                  <td>{team.name}</td>
                  <td className="muted">{team.campaign_name}</td>
                  <td>{team.supervisors.map((s) => s.full_name).join(', ') || <span className="warning">Sin supervisor</span>}</td>
                  <td className="tabular">{agentCount(team.id)}</td>
                  <td><StatusPill active={team.is_active} /></td>
                  <td className="cell-actions"><a className="button button-ghost" href={href(`equipos/${team.id}`)}>Editar</a></td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 && <p className="muted empty">Ningún equipo coincide con la búsqueda.</p>}
        </div>
      </section>
    </>
  );
}

function TeamCreate({ campaigns, run }) {
  const [name, setName] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const options = campaigns.filter((c) => c.is_active).map((c) => ({ value: c.id, label: c.name }));

  async function submit(event) {
    event.preventDefault();
    const created = await run(() => api('/admin/teams', { method: 'POST', body: { name, campaignId } }), 'Equipo creado');
    // Se abre el equipo para asignarle supervisores enseguida.
    if (created) navigate(`equipos/${created.team.id}`);
  }

  return (
    <>
      <PageHeader title="Agregar equipo" description="Después de crearlo podrás asignarle supervisores." />
      <form className="card stack form-narrow" onSubmit={submit}>
        <div className="field">
          <label htmlFor="team-campaign">Campaña</label>
          <SearchSelect id="team-campaign" required options={options} value={campaignId} onChange={setCampaignId} placeholder="Busca una campaña…" />
        </div>
        <label className="field">Nombre del equipo<input required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></label>
        <div className="form-actions">
          <a className="button" href={href('equipos')}>Cancelar</a>
          <button type="submit" className="button button-primary">Crear equipo</button>
        </div>
      </form>
    </>
  );
}

function TeamEdit({ team, users, run }) {
  const [name, setName] = useState(team.name);
  const [isActive, setIsActive] = useState(team.is_active);
  const [candidate, setCandidate] = useState('');
  const supervisorIds = team.supervisors.map((s) => s.id);
  const options = users
    .filter((user) => user.role === 'supervisor' && user.is_active && !supervisorIds.includes(user.id))
    .map((user) => ({ value: user.id, label: user.full_name, hint: user.email }));
  const agents = users.filter((user) => user.team_id === team.id);

  const saveSupervisors = (userIds, message) => run(
    () => api(`/admin/teams/${team.id}/supervisors`, { method: 'PUT', body: { userIds } }),
    message,
  );

  async function submit(event) {
    event.preventDefault();
    await run(() => api(`/admin/teams/${team.id}`, { method: 'PATCH', body: { name, isActive } }), 'Equipo actualizado');
  }

  return (
    <>
      <PageHeader title="Editar equipo" description={team.campaign_name} />
      <div className="columns">
        <form className="card stack" onSubmit={submit}>
          <h2>Datos del equipo</h2>
          <label className="field">Nombre<input required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="checkbox">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Equipo activo
          </label>
          <div className="form-actions">
            <a className="button" href={href('equipos')}>Volver</a>
            <button type="submit" className="button button-primary">Guardar cambios</button>
          </div>
        </form>
        <section className="card stack">
          <h2>Supervisores</h2>
          {team.supervisors.length === 0 && <p className="warning small">Este equipo no tiene supervisor: nadie atenderá su cola de ayuda.</p>}
          <ul className="admin-list">
            {team.supervisors.map((supervisor) => (
              <li key={supervisor.id}>
                <span>{supervisor.full_name}</span>
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => saveSupervisors(supervisorIds.filter((id) => id !== supervisor.id), 'Supervisor retirado')}
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
          <form
            className="inline-form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (await saveSupervisors([...supervisorIds, candidate], 'Supervisor asignado')) setCandidate('');
            }}
          >
            <SearchSelect aria-label="Supervisor a asignar" required options={options} value={candidate} onChange={setCandidate} placeholder="Busca un supervisor…" />
            <button type="submit" className="button button-primary">Asignar</button>
          </form>
          <h2 className="section-title">Agentes ({agents.length})</h2>
          {agents.length === 0 ? (
            <p className="muted small">Asigna agentes a este equipo desde la edición de cada usuario.</p>
          ) : (
            <ul className="plain-list small">
              {agents.map((agent) => <li key={agent.id}><a href={href(`usuarios/${agent.id}`)}>{agent.full_name}</a></li>)}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

// ---------- Vista ----------

export function AdminView({ user, notify, onLogout }) {
  const [campaigns, setCampaigns] = useState([]);
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [section = 'usuarios', itemId] = useHashRoute();

  const reload = useCallback(async () => {
    const [campaignData, teamData, userData] = await Promise.all([
      api('/admin/campaigns'), api('/admin/teams'), api('/admin/users'),
    ]);
    setCampaigns(campaignData.campaigns);
    setTeams(teamData.teams);
    setUsers(userData.users);
    setLoaded(true);
  }, []);

  useEffect(() => {
    reload().catch((failure) => notify(failure.message, 'error'));
  }, [reload, notify]);

  // Devuelve la respuesta de la API (o null si falló) y recarga los datos.
  const run = async (action, successMessage) => {
    try {
      const result = await action();
      notify(successMessage, 'success');
      await reload();
      return result ?? {};
    } catch (failure) {
      notify(failure.message, 'error');
      return null;
    }
  };

  const isNew = itemId === NEW_PAGES[section];
  const currentId = PAGES.some((page) => page.id === section) ? (isNew ? `${section}/${itemId}` : section) : 'usuarios';
  const find = (list) => list.find((item) => item.id === itemId);

  const renderPage = () => {
    if (!loaded) return <p className="muted">Cargando…</p>;
    if (section === 'campanas') {
      if (isNew) return <CampaignForm run={run} />;
      if (itemId) return find(campaigns) ? <CampaignForm key={itemId} campaign={find(campaigns)} run={run} /> : <NotFound what="la campaña" back="campanas" />;
      return <CampaignList campaigns={campaigns} teams={teams} />;
    }
    if (section === 'equipos') {
      if (isNew) return <TeamCreate campaigns={campaigns} run={run} />;
      if (itemId) return find(teams) ? <TeamEdit key={itemId} team={find(teams)} users={users} run={run} /> : <NotFound what="el equipo" back="equipos" />;
      return <TeamList teams={teams} users={users} />;
    }
    if (isNew) return <UserCreate teams={teams} run={run} />;
    if (itemId) return find(users) ? <UserEdit key={itemId} user={find(users)} teams={teams} run={run} /> : <NotFound what="el usuario" back="usuarios" />;
    return <UserList users={users} />;
  };

  return (
    <Shell user={user} onLogout={onLogout} pages={PAGES} currentId={currentId}>
      {renderPage()}
    </Shell>
  );
}
