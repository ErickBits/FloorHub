import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { ROLE_LABELS } from '../format.js';

function Campaigns({ campaigns, run }) {
  const [name, setName] = useState('');
  return (
    <section className="card">
      <h2>Campañas</h2>
      <form
        className="inline-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (await run(() => api('/admin/campaigns', { method: 'POST', body: { name } }), 'Campaña creada')) setName('');
        }}
      >
        <input required aria-label="Nombre de la campaña" placeholder="Nombre de la campaña" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="button button-primary">Crear</button>
      </form>
      <ul className="admin-list">
        {campaigns.map((campaign) => (
          <li key={campaign.id}>
            <span className={campaign.is_active ? '' : 'muted'}>{campaign.name}</span>
            <button
              type="button"
              className="button button-ghost"
              onClick={() => run(() => api(`/admin/campaigns/${campaign.id}`, { method: 'PATCH', body: { isActive: !campaign.is_active } }), 'Campaña actualizada')}
            >
              {campaign.is_active ? 'Desactivar' : 'Activar'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Teams({ teams, campaigns, supervisors, run }) {
  const [name, setName] = useState('');
  const [campaignId, setCampaignId] = useState('');
  return (
    <section className="card">
      <h2>Equipos</h2>
      <form
        className="inline-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (await run(() => api('/admin/teams', { method: 'POST', body: { name, campaignId } }), 'Equipo creado')) setName('');
        }}
      >
        <select required aria-label="Campaña" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
          <option value="" disabled>Campaña</option>
          {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
        </select>
        <input required aria-label="Nombre del equipo" placeholder="Nombre del equipo" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="button button-primary">Crear</button>
      </form>
      <ul className="admin-list">
        {teams.map((team) => (
          <li key={team.id} className="admin-team">
            <div>
              <strong>{team.name}</strong>
              <div className="small muted">{team.campaign_name}</div>
            </div>
            <label className="field">
              Supervisor
              <select
                value={team.supervisors[0]?.id ?? ''}
                onChange={(e) => run(
                  () => api(`/admin/teams/${team.id}/supervisors`, { method: 'PUT', body: { userIds: e.target.value ? [e.target.value] : [] } }),
                  'Supervisor asignado',
                )}
              >
                <option value="">Sin supervisor</option>
                {supervisors.map((user) => <option key={user.id} value={user.id}>{user.full_name}</option>)}
              </select>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Users({ users, teams, run }) {
  const empty = { fullName: '', email: '', password: '', role: 'agent', teamId: '' };
  const [form, setForm] = useState(empty);
  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  return (
    <section className="card">
      <h2>Usuarios</h2>
      <form
        className="stack"
        onSubmit={async (event) => {
          event.preventDefault();
          const body = { ...form, teamId: form.role === 'agent' ? form.teamId : null };
          if (await run(() => api('/admin/users', { method: 'POST', body }), 'Usuario creado')) setForm(empty);
        }}
      >
        <div className="form-row">
          <label className="field">Nombre<input required value={form.fullName} onChange={set('fullName')} /></label>
          <label className="field">Correo<input required type="email" value={form.email} onChange={set('email')} /></label>
          <label className="field">Contraseña<input required type="password" minLength={8} maxLength={72} autoComplete="new-password" value={form.password} onChange={set('password')} /></label>
          <label className="field">
            Rol
            <select value={form.role} onChange={set('role')}>
              {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          {form.role === 'agent' && (
            <label className="field">
              Equipo
              <select required value={form.teamId} onChange={set('teamId')}>
                <option value="" disabled>Elige un equipo</option>
                {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
            </label>
          )}
        </div>
        <button type="submit" className="button button-primary">Crear usuario</button>
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Equipo</th><th>Estado</th></tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.full_name}</td>
                <td>{user.email}</td>
                <td>{ROLE_LABELS[user.role]}</td>
                <td>{user.team_name ?? '—'}</td>
                <td>
                  <button
                    type="button"
                    className="button button-ghost"
                    onClick={() => run(() => api(`/admin/users/${user.id}`, { method: 'PATCH', body: { isActive: !user.is_active } }), 'Usuario actualizado')}
                  >
                    {user.is_active ? 'Activo · desactivar' : 'Inactivo · activar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function AdminView({ notify }) {
  const [campaigns, setCampaigns] = useState([]);
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);

  const reload = useCallback(async () => {
    const [campaignData, teamData, userData] = await Promise.all([
      api('/admin/campaigns'), api('/admin/teams'), api('/admin/users'),
    ]);
    setCampaigns(campaignData.campaigns);
    setTeams(teamData.teams);
    setUsers(userData.users);
  }, []);

  useEffect(() => {
    reload().catch((failure) => notify(failure.message, 'error'));
  }, [reload, notify]);

  const run = async (action, successMessage) => {
    try {
      await action();
      notify(successMessage, 'success');
      await reload();
      return true;
    } catch (failure) {
      notify(failure.message, 'error');
      return false;
    }
  };

  return (
    <>
      <h1 className="page-header">Administración</h1>
      <div className="columns columns-admin">
        <Campaigns campaigns={campaigns} run={run} />
        <Teams teams={teams} campaigns={campaigns} supervisors={users.filter((user) => user.role === 'supervisor')} run={run} />
      </div>
      <Users users={users} teams={teams} run={run} />
    </>
  );
}
