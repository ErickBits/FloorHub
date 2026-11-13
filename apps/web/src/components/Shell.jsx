import { ROLE_LABELS } from '../format.js';
import { href } from '../router.js';

// Estructura común: barra superior y menú lateral con una entrada por función.
// pages: [{ id, label, section?, badge?, badgeTone? }]
export function Shell({ user, onLogout, pages, currentId, status, children }) {
  let lastSection = null;
  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">FloorHub</div>
        <div className="topbar-user">
          {status}
          <span className="topbar-name">
            <strong>{user.fullName}</strong>
            <span className="muted"> · {ROLE_LABELS[user.role]}</span>
          </span>
          <button type="button" className="button button-ghost" onClick={onLogout}>Salir</button>
        </div>
      </header>
      <div className="layout">
        <nav className="sidebar" aria-label="Funciones">
          <ul>
            {pages.map((page) => {
              const heading = page.section && page.section !== lastSection ? page.section : null;
              lastSection = page.section;
              return (
                <li key={page.id}>
                  {heading && <div className="sidebar-section">{heading}</div>}
                  <a
                    href={href(page.id)}
                    className={`sidebar-link ${page.id === currentId ? 'sidebar-link-active' : ''}`}
                    aria-current={page.id === currentId ? 'page' : undefined}
                  >
                    <span>{page.label}</span>
                    {page.badge ? <span className={`badge ${page.badgeTone ?? ''}`}>{page.badge}</span> : null}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p className="muted small">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function ConnectionBadge({ connected }) {
  return (
    <span className={`connection ${connected ? 'connection-on' : 'connection-off'}`}>
      {connected ? 'Disponible' : 'Reconectando…'}
    </span>
  );
}
