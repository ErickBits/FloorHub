import { useState } from 'react';
import { api, session } from '../api.js';

export function LoginView({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { token } = await api('/auth/login', { method: 'POST', body: { email, password } });
      session.token = token;
      const { user } = await api('/auth/me');
      onLogin(user);
    } catch (failure) {
      session.token = null;
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-screen">
      <form className="card login" onSubmit={submit}>
        <h1 className="brand brand-large">FloorHub</h1>
        <p className="muted">Comunicados y ayuda en vivo para el piso de operaciones.</p>
        <label className="field">
          Correo
          <input type="email" required autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          Contraseña
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="button button-primary" disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
