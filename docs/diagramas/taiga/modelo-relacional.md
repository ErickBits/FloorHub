# Diagrama relacional

**Modelo lógico · PostgreSQL 17 · 9 tablas**

Refleja `db/migrations/001_initial_schema.sql`.

Convenciones: **PK** = llave primaria · **FK** = llave foránea · **UQ** = valor único.

## Tablas

### campaigns

| Llave | Columna | Tipo |
|---|---|---|
| PK | id | uuid |
| UQ | name | text |
| | is_active | boolean |
| | created_at | timestamptz |

### teams

| Llave | Columna | Tipo |
|---|---|---|
| PK | id | uuid |
| FK → campaigns.id | campaign_id | uuid |
| | name | text |
| | is_active | boolean |
| | created_at | timestamptz |

### users

| Llave | Columna | Tipo |
|---|---|---|
| PK | id | uuid |
| UQ | email | text |
| | password_hash | text |
| | full_name | text |
| | role | user_role |
| FK → teams.id | team_id | uuid |
| | is_active | boolean |
| | created_at | timestamptz |
| | updated_at | timestamptz |

### team_supervisors

| Llave | Columna | Tipo |
|---|---|---|
| PK, FK → teams.id | team_id | uuid |
| PK, FK → users.id | user_id | uuid |

### help_requests

| Llave | Columna | Tipo |
|---|---|---|
| PK | id | uuid |
| FK → teams.id | team_id | uuid |
| FK → users.id | agent_id | uuid |
| | type | help_type |
| | priority | smallint |
| | summary | text |
| | status | help_status |
| FK → users.id | claimed_by | uuid |
| | created_at | timestamptz |
| | claimed_at | timestamptz |
| | resolved_at | timestamptz |

### announcements

| Llave | Columna | Tipo |
|---|---|---|
| PK | id | uuid |
| FK → users.id | author_id | uuid |
| | title | text |
| | body | text |
| | priority | announcement_priority |
| | reminder_interval_minutes | integer |
| | reminders_sent | integer |
| | next_reminder_at | timestamptz |
| | expires_at | timestamptz |
| | published_at | timestamptz |

### announcement_targets

| Llave | Columna | Tipo |
|---|---|---|
| PK | id | uuid |
| FK → announcements.id | announcement_id | uuid |
| FK → campaigns.id | campaign_id | uuid |
| FK → teams.id | team_id | uuid |
| FK → users.id | user_id | uuid |

### announcement_recipients

| Llave | Columna | Tipo |
|---|---|---|
| PK, FK → announcements.id | announcement_id | uuid |
| PK, FK → users.id | user_id | uuid |
| | reminder_count | integer |
| | last_reminded_at | timestamptz |

### announcement_acks

| Llave | Columna | Tipo |
|---|---|---|
| PK, FK → announcement_recipients | announcement_id | uuid |
| PK, FK → announcement_recipients | user_id | uuid |
| | acknowledged_at | timestamptz |

## Reglas que garantiza la base de datos

- Solo los agentes tienen `team_id` (CHECK).
- Un destino apunta a una sola cosa: campaña, equipo o usuario (CHECK `num_nonnulls = 1`).
- Un agente tiene a lo sumo una solicitud activa.
- `announcement_acks` es de solo inserción (triggers).
- Un comunicado publicado no se puede editar.
- Borrados restringidos: los usuarios se desactivan.

## Diagrama

![Diagrama relacional](https://raw.githubusercontent.com/ErickBits/FloorHubisores-atienden-en-tiempo-real./main/docs/diagramas/modelo-relacional.png)
