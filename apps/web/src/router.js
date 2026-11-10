import { useEffect, useState } from 'react';

// Enrutado por hash: no necesita configuración en Nginx y cada ventana conserva su página.
function readPath() {
  return window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
}

export function useHashRoute() {
  const [path, setPath] = useState(readPath);
  useEffect(() => {
    const onChange = () => setPath(readPath());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return path;
}

export const href = (path) => `#/${path}`;

export function navigate(path) {
  window.location.hash = `/${path}`;
}
