-- Up Migration

CREATE TYPE user_role AS ENUM ('agent', 'supervisor', 'admin');
CREATE TYPE announcement_priority AS ENUM ('info', 'critical');
CREATE TYPE help_type AS ENUM ('approval', 'difficult_customer', 'process_question');
CREATE TYPE help_status AS ENUM ('pending', 'in_progress', 'resolved');

CREATE TABLE campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns (id) ON DELETE RESTRICT,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, name)
);
CREATE INDEX teams_campaign_idx ON teams (campaign_id);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  role user_role NOT NULL,
  team_id uuid REFERENCES teams (id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Solo los agentes pertenecen directamente a un equipo.
  CONSTRAINT users_team_matches_role CHECK ((role = 'agent') = (team_id IS NOT NULL))
);
CREATE UNIQUE INDEX users_email_unique_idx ON users (lower(email));
CREATE INDEX users_team_idx ON users (team_id);

CREATE TABLE team_supervisors (
  team_id uuid NOT NULL REFERENCES teams (id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  PRIMARY KEY (team_id, user_id)
);
CREATE INDEX team_supervisors_user_idx ON team_supervisors (user_id);

CREATE TABLE announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  priority announcement_priority NOT NULL,
  reminder_interval_minutes integer CHECK (reminder_interval_minutes > 0),
  reminders_sent integer NOT NULL DEFAULT 0,
  next_reminder_at timestamptz,
  expires_at timestamptz,
  published_at timestamptz NOT NULL DEFAULT now(),
  -- Los comunicados críticos siempre tienen recordatorios y los informativos nunca.
  CONSTRAINT announcements_reminder_matches_priority
    CHECK ((priority = 'critical') = (reminder_interval_minutes IS NOT NULL))
);
CREATE INDEX announcements_published_idx ON announcements (published_at DESC);
CREATE INDEX announcements_author_idx ON announcements (author_id);
CREATE INDEX announcements_next_reminder_idx ON announcements (next_reminder_at)
  WHERE next_reminder_at IS NOT NULL;

CREATE TABLE announcement_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES announcements (id) ON DELETE RESTRICT,
  campaign_id uuid REFERENCES campaigns (id) ON DELETE RESTRICT,
  team_id uuid REFERENCES teams (id) ON DELETE RESTRICT,
  user_id uuid REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT announcement_targets_exactly_one
    CHECK (num_nonnulls(campaign_id, team_id, user_id) = 1)
);
CREATE INDEX announcement_targets_announcement_idx ON announcement_targets (announcement_id);

-- Foto fija de la audiencia al publicar: no cambia si un agente se muda de equipo.
CREATE TABLE announcement_recipients (
  announcement_id uuid NOT NULL REFERENCES announcements (id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  reminder_count integer NOT NULL DEFAULT 0,
  last_reminded_at timestamptz,
  PRIMARY KEY (announcement_id, user_id)
);
CREATE INDEX announcement_recipients_user_idx ON announcement_recipients (user_id, announcement_id);

-- Registro de auditoría: la llave foránea impide confirmar a quien no es destinatario.
CREATE TABLE announcement_acks (
  announcement_id uuid NOT NULL,
  user_id uuid NOT NULL,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id),
  FOREIGN KEY (announcement_id, user_id)
    REFERENCES announcement_recipients (announcement_id, user_id) ON DELETE RESTRICT
);

CREATE TABLE help_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams (id) ON DELETE RESTRICT,
  agent_id uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  type help_type NOT NULL,
  priority smallint NOT NULL,
  summary text NOT NULL CHECK (char_length(summary) BETWEEN 1 AND 500),
  status help_status NOT NULL DEFAULT 'pending',
  claimed_by uuid REFERENCES users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  resolved_at timestamptz,
  -- Cada estado exige exactamente los datos que le corresponden.
  CONSTRAINT help_requests_state_is_consistent CHECK (
    (status = 'pending' AND claimed_by IS NULL AND claimed_at IS NULL AND resolved_at IS NULL)
    OR (status = 'in_progress' AND claimed_by IS NOT NULL AND claimed_at IS NOT NULL AND resolved_at IS NULL)
    OR (status = 'resolved' AND claimed_by IS NOT NULL AND claimed_at IS NOT NULL AND resolved_at IS NOT NULL)
  )
);
CREATE INDEX help_requests_queue_idx ON help_requests (team_id, priority DESC, created_at)
  WHERE status = 'pending';
CREATE UNIQUE INDEX help_requests_one_active_per_agent_idx ON help_requests (agent_id)
  WHERE status IN ('pending', 'in_progress');
CREATE INDEX help_requests_claimed_by_idx ON help_requests (claimed_by, status);

-- Auditoría de solo inserción: los triggers actúan aunque alguien conceda el permiso.
CREATE FUNCTION reject_audit_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'announcement_acks es un registro de auditoría y no se puede modificar'
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER announcement_acks_no_change
  BEFORE UPDATE OR DELETE ON announcement_acks
  FOR EACH ROW EXECUTE FUNCTION reject_audit_change();

CREATE TRIGGER announcement_acks_no_truncate
  BEFORE TRUNCATE ON announcement_acks
  FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_change();

-- Una confirmación debe seguir probando qué texto se leyó.
CREATE FUNCTION reject_announcement_content_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'el contenido de un comunicado publicado no se puede modificar'
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER announcements_immutable_content
  BEFORE UPDATE OF title, body, priority, author_id, published_at ON announcements
  FOR EACH ROW EXECUTE FUNCTION reject_announcement_content_change();

-- La aplicación usa un rol con permisos mínimos; las migraciones usan el rol dueño.
GRANT SELECT, INSERT, UPDATE ON campaigns, teams, users, help_requests TO floorhub_app;
GRANT SELECT, INSERT, DELETE ON team_supervisors TO floorhub_app;
GRANT SELECT, INSERT ON announcements, announcement_targets, announcement_recipients, announcement_acks TO floorhub_app;
GRANT UPDATE (reminders_sent, next_reminder_at) ON announcements TO floorhub_app;
GRANT UPDATE (reminder_count, last_reminded_at) ON announcement_recipients TO floorhub_app;

-- Down Migration

DROP TABLE help_requests, announcement_acks, announcement_recipients, announcement_targets,
  announcements, team_supervisors, users, teams, campaigns;
DROP FUNCTION reject_audit_change();
DROP FUNCTION reject_announcement_content_change();
DROP TYPE help_status, help_type, announcement_priority, user_role;
