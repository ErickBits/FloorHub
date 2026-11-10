# Diagrama entidad-relación

**Modelo conceptual · notación de Chen**

## Entidades y atributos

Los atributos en **negrita** son el identificador único.

| Entidad | Atributos |
|---|---|
| CAMPAÑA | **id_campaña**, nombre, activa, fecha creación |
| EQUIPO | **id_equipo**, nombre, activo |
| USUARIO | **id_usuario**, correo, nombre completo, rol, contraseña (hash), activo |
| COMUNICADO | **id_comunicado**, título, mensaje, prioridad, recordar cada (min), fecha publicación |
| SOLICITUD DE AYUDA | **id_solicitud**, tipo, prioridad, resumen, estado, creada / tomada / resuelta |

## Relaciones

| Relación | Entidades | Cardinalidad | Atributos de la relación | Nota |
|---|---|---|---|---|
| agrupa | CAMPAÑA – EQUIPO | 1 : N | — | |
| integra | EQUIPO – USUARIO | 1 : N | — | Solo agentes |
| supervisa | EQUIPO – USUARIO | M : N | — | Solo supervisores |
| publica | USUARIO – COMUNICADO | 1 : N | — | |
| recibe | USUARIO – COMUNICADO | M : N | n.º recordatorios, último recordatorio | |
| confirma | USUARIO – COMUNICADO | M : N | fecha confirmación | |
| se dirige a | COMUNICADO – CAMPAÑA / EQUIPO / USUARIO | M : N | — | Exactamente un destino por registro |
| pertenece a | EQUIPO – SOLICITUD DE AYUDA | 1 : N | — | |
| crea | USUARIO – SOLICITUD DE AYUDA | 1 : N | — | El agente |
| atiende | USUARIO – SOLICITUD DE AYUDA | 1 : N | — | El supervisor |

## Convenciones

| Elemento | Significado |
|---|---|
| Entidad | Objeto del negocio con datos propios |
| Relación | Vínculo entre entidades; 1, N y M son cardinalidades |
| Atributo | Dato; el identificador único va resaltado |

## Diagrama

![Diagrama entidad-relación](https://raw.githubusercontent.com/ErickBits/FloorHubisores-atienden-en-tiempo-real./main/docs/diagramas/entidad-relacion.png)
