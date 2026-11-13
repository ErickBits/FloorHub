-- Up Migration

-- Conversación entre el agente y el supervisor que tomó la solicitud; se conserva como historial.
CREATE TABLE help_request_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  help_request_id uuid NOT NULL REFERENCES help_requests (id) ON DELETE RESTRICT,
  author_id uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX help_request_replies_request_idx ON help_request_replies (help_request_id, created_at);

GRANT SELECT, INSERT ON help_request_replies TO floorhub_app;

-- Down Migration

DROP TABLE help_request_replies;
