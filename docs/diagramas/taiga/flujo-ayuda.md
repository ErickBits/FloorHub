# Diagrama de flujo: solicitudes de ayuda

**Levantar la mano, tomar y resolver**

Actores (carriles): **Agente**, **Sistema FloorHub** y **Supervisor**.

## Pasos

| # | Actor | Paso | Siguiente |
|---|---|---|---|
| 1 | Agente | **Inicio** | 2 |
| 2 | Agente | Elige el tipo y escribe un resumen | 3 |
| 3 | Agente | Pulsa «Solicitar ayuda» | 4 |
| 4 | Sistema | **¿Ya tiene una solicitud activa?** | Sí → 5 · No → 6 |
| 5 | Sistema | ❌ Rechaza: solo se permite una solicitud activa | Fin |
| 6 | Sistema | Asigna la prioridad según el tipo: cliente difícil 3 · aprobación 2 · duda de proceso 1 | 7 |
| 7 | Sistema | 🗄️ Guarda la solicitud como «Pendiente» | 8 |
| 8 | Sistema | Avisa en vivo a los supervisores del equipo | 9 |
| 9 | Supervisor | Ve la solicitud en la cola, ordenada por prioridad | 10 |
| 10 | Supervisor | Pulsa «Tomar» | 11 |
| 11 | Sistema | **¿Otro supervisor la tomó primero?** | Sí → 12 · No → 13 |
| 12 | Supervisor | ❌ Ve el aviso «ya fue tomada» (409) | Sigue con la cola → 9 |
| 13 | Sistema | Cambia a «En atención» y mide el tiempo de espera | 14 y 15 |
| 14 | Agente | Ve en vivo qué supervisor lo atiende | — |
| 15 | Supervisor | Atiende al agente y pulsa «Resolver» | 16 |
| 16 | Sistema | Cambia a «Resuelta» y mide el tiempo de atención | 17 |
| 17 | Agente | Ve su solicitud resuelta con los tiempos | Fin |

## Diagrama

![Diagrama de flujo: solicitudes de ayuda](https://raw.githubusercontent.com/ErickBits/FloorHubisores-atienden-en-tiempo-real./main/docs/diagramas/flujo-ayuda.png)
