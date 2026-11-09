import { EVENTS, rooms } from '@floorhub/shared';
import { AppError, conflict, notFound } from '../errors.js';

// La prioridad la fija el servidor: si la eligiera el agente, todo sería urgente.
export const PRIORITY_BY_TYPE = { difficult_customer: 3, approval: 2, process_question: 1 };

const SELECT_REQUEST = `
  SELECT h.id, h.team_id, h.agent_id, h.type, h.priority, h.summary, h.status, h.claimed_by,
         h.created_at, h.claimed_at, h.resolved_at,
         agent.full_name AS agent_name, supervisor.full_name AS supervisor_name,
         EXTRACT(EPOCH FROM (COALESCE(h.claimed_at, now()) - h.created_at))::int AS wait_seconds,
         EXTRACT(EPOCH FROM (h.resolved_at - h.claimed_at))::int AS resolution_seconds
    FROM help_requests h
    JOIN users agent ON agent.id = h.agent_id
    LEFT JOIN users supervisor ON supervisor.id = h.claimed_by`;

const QUEUE_ORDER = "CASE h.status WHEN 'pending' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, h.priority DESC, h.created_at";

async function fetchRequest(pool, id) {
  const { rows } = await pool.query(`${SELECT_REQUEST} WHERE h.id = $1`, [id]);
  return rows[0];
}

function broadcast(context, event, request) {
  context.background(
    Promise.resolve(
      context.emitter
        .to([rooms.teamSupervisors(request.team_id), rooms.user(request.agent_id)])
        .emit(event, request),
    ),
    'No se pudo emitir el evento de ayuda',
  );
}

export async function createRequest(context, user, input) {
  let id;
  try {
    const { rows } = await context.pool.query(
      `INSERT INTO help_requests (team_id, agent_id, type, priority, summary)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [user.teamIds[0], user.id, input.type, PRIORITY_BY_TYPE[input.type], input.summary],
    );
    id = rows[0].id;
  } catch (error) {
    if (error.code === '23505') throw conflict('active_request_exists', 'Ya tienes una solicitud activa');
    throw error;
  }
  const request = await fetchRequest(context.pool, id);
  broadcast(context, EVENTS.helpCreated, request);
  return request;
}

export async function listRequests({ pool }, user) {
  // Las resueltas se limitan a las últimas 24 h para que la vista en vivo siga siendo liviana.
  const recent = "(h.status <> 'resolved' OR h.resolved_at > now() - interval '24 hours')";
  const { rows } = user.role === 'agent'
    ? await pool.query(
      `${SELECT_REQUEST} WHERE h.agent_id = $1 AND ${recent} ORDER BY h.created_at DESC LIMIT 50`,
      [user.id],
    )
    : await pool.query(
      `${SELECT_REQUEST} WHERE h.team_id = ANY($1) AND ${recent} ORDER BY ${QUEUE_ORDER} LIMIT 200`,
      [user.teamIds],
    );
  return rows;
}

// Operación atómica: PostgreSQL bloquea la fila y el segundo UPDATE vuelve a evaluar el WHERE.
// Si otro supervisor ganó, el estado ya no es 'pending' y no se actualiza ninguna fila.
export async function claimRequest(context, user, id) {
  const { rowCount } = await context.pool.query(
    `UPDATE help_requests
        SET status = 'in_progress', claimed_by = $1, claimed_at = now()
      WHERE id = $2 AND status = 'pending' AND team_id = ANY($3)
      RETURNING id`,
    [user.id, id, user.teamIds],
  );
  if (rowCount === 0) {
    const { rows } = await context.pool.query(
      'SELECT status FROM help_requests WHERE id = $1 AND team_id = ANY($2)',
      [id, user.teamIds],
    );
    if (rows.length === 0) throw notFound('Solicitud no encontrada');
    throw conflict('already_claimed', 'Otro supervisor ya tomó esta solicitud');
  }
  const request = await fetchRequest(context.pool, id);
  broadcast(context, EVENTS.helpClaimed, request);
  return request;
}

export async function resolveRequest(context, user, id) {
  const { rowCount } = await context.pool.query(
    `UPDATE help_requests SET status = 'resolved', resolved_at = now()
      WHERE id = $1 AND status = 'in_progress' AND claimed_by = $2
      RETURNING id`,
    [id, user.id],
  );
  if (rowCount === 0) {
    const { rows } = await context.pool.query(
      'SELECT status FROM help_requests WHERE id = $1 AND team_id = ANY($2)',
      [id, user.teamIds],
    );
    if (rows.length === 0) throw notFound('Solicitud no encontrada');
    throw new AppError(409, 'cannot_resolve', 'Solo quien atiende la solicitud puede resolverla');
  }
  const request = await fetchRequest(context.pool, id);
  broadcast(context, EVENTS.helpResolved, request);
  return request;
}
