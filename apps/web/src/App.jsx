import { useCallback, useEffect, useState } from 'react';
import { api, session, setUnauthorizedHandler } from './api.js';
import { Toasts, useToasts } from './components/Toasts.jsx';
import { AdminView } from './views/AdminView.jsx';
import { AgentView } from './views/AgentView.jsx';
import { LoginView } from './views/LoginView.jsx';
import { SupervisorView } from './views/SupervisorView.jsx';

const VIEWS = { agent: AgentView, supervisor: SupervisorView, admin: AdminView };

export function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(session.token));
  const { toasts, notify } = useToasts();

  const logout = useCallback(() => {
    session.token = null;
    setUser(null);
    window.location.hash = '';
  }, []);

  useEffect(() => setUnauthorizedHandler(logout), [logout]);

  useEffect(() => {
    if (!session.token) return;
    api('/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="center-screen">Cargando…</div>;

  const View = user && VIEWS[user.role];
  return (
    <>
      {user ? <View user={user} notify={notify} onLogout={logout} /> : <LoginView onLogin={setUser} />}
      <Toasts toasts={toasts} />
    </>
  );
}
