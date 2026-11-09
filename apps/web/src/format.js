const timeFormat = new Intl.DateTimeFormat('es', { dateStyle: 'short', timeStyle: 'medium' });

export const formatDateTime = (value) => (value ? timeFormat.format(new Date(value)) : '—');

export function formatDuration(totalSeconds) {
  if (totalSeconds === null || totalSeconds === undefined) return '—';
  const seconds = Math.max(0, Math.round(totalSeconds));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ${seconds % 60} s`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export const HELP_TYPES = {
  difficult_customer: 'Cliente difícil',
  approval: 'Aprobación',
  process_question: 'Duda de proceso',
};

export const HELP_STATUS = {
  pending: 'Pendiente',
  in_progress: 'En atención',
  resolved: 'Resuelta',
};

export const ROLE_LABELS = {
  agent: 'Agente',
  supervisor: 'Supervisor',
  admin: 'Administrador',
};
