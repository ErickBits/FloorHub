# Diagrama de estados: solicitud de ayuda

**Ciclo de vida de una solicitud**

## Estados

| Estado | Etiqueta | Datos que exige la base |
|---|---|---|
| pending | Pendiente | Sin responsable ni fechas de toma o resolución |
| in_progress | En atención | claimed_by y claimed_at |
| resolved | Resuelta | claimed_by, claimed_at y resolved_at |

## Transiciones

| Desde | Hacia | Evento | Quién |
|---|---|---|---|
| (inicio) | pending | Levanta la mano; la prioridad la asigna el servidor | Agente |
| pending | in_progress | Toma la solicitud (UPDATE atómico) | Supervisor del equipo |
| in_progress | resolved | Resuelve la solicitud | El mismo supervisor |
| resolved | (fin) | — | — |

## Regla

Un agente tiene como máximo una solicitud `pending` o `in_progress` (índice único parcial).

## Diagrama

![Diagrama de estados de una solicitud](https://raw.githubusercontent.com/ErickBits/FloorHubisores-atienden-en-tiempo-real./main/docs/diagramas/estados_solicitud.png)
