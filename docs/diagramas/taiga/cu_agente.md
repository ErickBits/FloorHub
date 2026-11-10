# Diagrama de casos de uso: agente y sistema

**Operación diaria del agente**

Actores: **Agente** y **Sistema (worker)**.

## Casos de uso

| Código | Caso de uso | Actor | Relación |
|---|---|---|---|
| CU-01 | Iniciar sesión | Agente | — |
| CU-02 | Cerrar sesión | Agente | — |
| CU-03 | Consultar comunicados | Agente | — |
| CU-04 | Confirmar lectura | Agente | «extend» de CU-03 |
| CU-05 | Levantar la mano | Agente | — |
| CU-06 | Seguir mis solicitudes | Agente | — |
| CU-13 | Enviar recordatorios | Sistema | — |
| CU-14 | Generar resumen diario | Sistema | — |

## Diagrama

![Casos de uso del agente](https://raw.githubusercontent.com/ErickBits/FloorHubisores-atienden-en-tiempo-real./main/docs/diagramas/cu_agente.png)
