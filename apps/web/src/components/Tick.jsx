import { useEffect, useState } from 'react';
import { formatDuration } from '../format.js';

// Tiempo transcurrido que avanza solo, sin volver a pedir datos al servidor.
export function Elapsed({ since }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return <span className="tabular">{formatDuration((now - new Date(since).getTime()) / 1000)}</span>;
}
