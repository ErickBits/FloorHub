# Diagrama de flujo general

**Acceso al sistema y funciones según el rol**

## Pasos

1. **Inicio.** El usuario abre FloorHub en el navegador.
2. **¿Tiene una sesión activa en esta ventana?**
   - **Sí** → pasa directamente al paso 7.
   - **No** → continúa en el paso 3.
3. El usuario **ingresa correo y contraseña**.
4. **¿Superó 10 intentos en un minuto?**
   - **Sí** → ❌ *Bloquear temporalmente (HTTP 429).* Debe esperar y vuelve al paso 3.
   - **No** → continúa en el paso 5.
5. **¿Credenciales válidas y usuario activo?**
   - **No** → ❌ *Mostrar «Correo o contraseña incorrectos».* Reintenta en el paso 3.
   - **Sí** → continúa en el paso 6.
6. Emitir **token JWT válido por 8 horas**.
7. Cargar el perfil y **conectar en tiempo real (WebSocket)**.
8. **¿Qué rol tiene?**

   | Rol | Funciones |
   |---|---|
   | Administrador | Gestiona usuarios, campañas y equipos |
   | Supervisor | Atiende la cola de ayuda, ve presencia y publica comunicados |
   | Agente | Lee y confirma comunicados, levanta la mano |

9. **¿Cierra sesión o venció el token?**
   - **No** → sigue trabajando (vuelve al paso 8).
   - **Sí** → borrar el token de la ventana.
10. **Fin.**

## Simbología

| Símbolo | Significado |
|---|---|
| Inicio/Fin | Comienzo o final |
| Proceso | Acción del usuario o del sistema |
| Decisión | Pregunta con dos salidas |
| Dato | Entrada de información |
| ❌ Error | Respuesta ante un fallo |

## Diagrama

![Diagrama de flujo general](https://raw.githubusercontent.com/ErickBits/FloorHubisores-atienden-en-tiempo-real./main/docs/diagramas/flujo-general.png)
