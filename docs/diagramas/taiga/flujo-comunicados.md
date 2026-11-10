# Diagrama de flujo: comunicados

**Publicación, confirmación y recordatorios automáticos**

Actores (carriles): **Supervisor**, **Sistema FloorHub** y **Agente**.

## Pasos

| # | Actor | Paso | Siguiente |
|---|---|---|---|
| 1 | Supervisor | **Inicio** | 2 |
| 2 | Supervisor | Redacta el título y el mensaje | 3 |
| 3 | Supervisor | Elige el destino con el buscador: campaña, equipo o agente | 4 |
| 4 | Supervisor | **¿Es crítico?** | Sí → 5 · No → 6 |
| 5 | Supervisor | Define cada cuántos minutos recordar | 6 |
| 6 | Supervisor | Pulsa «Publicar» | 7 |
| 7 | Sistema | **¿El destino está dentro de sus equipos?** | Sí → 9 · No → 8 |
| 8 | Sistema | ❌ Rechaza la publicación (403) y muestra el error | Corregir → 3 |
| 9 | Sistema | 🗄️ Guarda el comunicado y la lista fija de destinatarios | 10 |
| 10 | Sistema | Lo envía en tiempo real a cada destinatario | 11 |
| 11 | Agente | Recibe el aviso y lee el comunicado | 12 |
| 12 | Agente | **¿Pulsa «Leí y entendí»?** | Sí → 13 · No → 15 |
| 13 | Sistema | 🗄️ Registra la confirmación (auditoría de solo inserción) | 14 |
| 14 | Supervisor | Ve subir en vivo el porcentaje de confirmación | Fin |
| 15 | Sistema | **¿Es crítico?** | Sí → 16 · No → Fin |
| 16 | Sistema | Espera el intervalo definido | 17 |
| 17 | Sistema | **¿Quedan pendientes y van menos de 5 rondas?** | Sí → 18 · No → Fin |
| 18 | Agente | Recibe un recordatorio (solo quien no ha confirmado) | Vuelve a leer → 11 |

## Diagrama

![Diagrama de flujo: comunicados](https://raw.githubusercontent.com/ErickBits/FloorHubisores-atienden-en-tiempo-real./main/docs/diagramas/flujo-comunicados.png)
