# Diagrama entidad-relación (patas de gallo)

**Las 9 tablas y sus relaciones**

Complementa el diagrama en notación de Chen (`entidad-relacion.md`) y el relacional (`modelo-relacional.md`).

## Relaciones

| Tabla | Relación | Tabla | Cardinalidad |
|---|---|---|---|
| campaigns | agrupa | teams | 1 : N |
| teams | tiene agentes | users | 1 : N |
| teams | lo supervisan | team_supervisors | 1 : N |
| users | supervisa | team_supervisors | 1 : N |
| users | publica | announcements | 1 : N |
| announcements | se dirige a | announcement_targets | 1 : N (mín. 1) |
| campaigns / teams / users | destino | announcement_targets | 1 : N |
| announcements | se entrega a | announcement_recipients | 1 : N (mín. 1) |
| users | recibe | announcement_recipients | 1 : N |
| announcement_recipients | se confirma con | announcement_acks | 1 : 0..1 |
| teams | atiende | help_requests | 1 : N |
| users | crea / toma | help_requests | 1 : N |

## Diagrama

![Diagrama entidad-relación de las tablas](https://raw.githubusercontent.com/ErickBits/FloorHubisores-atienden-en-tiempo-real./main/docs/diagramas/der.png)
