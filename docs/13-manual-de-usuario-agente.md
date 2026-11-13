# Manual de Usuario — Agente — FloorHub

*Comunicados y ayuda en vivo para el piso de operaciones*

Esta guía cubre solo el rol de **agente**. Hay un manual por rol: [agente](13-manual-de-usuario-agente.md), [supervisor](13-manual-de-usuario-supervisor.md) y [administrador](13-manual-de-usuario-administrador.md).

La versión maquetada para imprimir está en [manual/manual-de-usuario-agente.pdf](manual/manual-de-usuario-agente.pdf).

## Tabla de contenido

1. [Antes de empezar](#1-antes-de-empezar)
2. [Acceso al sistema](#2-acceso-al-sistema)
3. [Recorrido por la interfaz](#3-recorrido-por-la-interfaz)
4. [Guía del agente](#4-guía-del-agente)
5. [Preguntas frecuentes y solución de problemas](#5-preguntas-frecuentes-y-solución-de-problemas)

---

## 1. Antes de empezar

### Qué necesitas

| Elemento | Requisito |
|---|---|
| Navegador | Google Chrome, Microsoft Edge, Mozilla Firefox o Safari en una versión actual |
| Conexión | Acceso a la red donde está publicada FloorHub; la conexión en vivo usa WebSocket |
| Pantalla | Computador, tableta o celular; se recomienda 1280 × 720 o más |
| Cuenta | Un usuario creado por el administrador (no hay registro abierto) |

### Tipos de usuario

| Rol | Quién es | Qué hace en FloorHub |
|---|---|---|
| Agente | Persona que atiende llamadas o chats de clientes | Lee y confirma comunicados y pide ayuda a su supervisor |
| Supervisor | Líder de uno o varios equipos | Publica comunicados, atiende la cola de ayuda y ve la presencia de su equipo |
| Administrador | Responsable de la plataforma | Crea y edita usuarios, campañas y equipos, y asigna supervisores |

Una **campaña** agrupa los equipos que atienden a un mismo cliente. Un agente pertenece a un solo equipo; un supervisor puede supervisar varios.

### Conceptos básicos

| Tipo de comunicado | Uso | Recordatorios |
|---|---|---|
| Informativo | Avisos generales: mantenimientos, horarios, noticias | No |
| Crítico | Cambios que el agente debe aplicar ya: precios, guiones, procesos | Cada N minutos a quien no ha confirmado, hasta 5 rondas |

| Tipo de solicitud de ayuda | Prioridad | Ejemplo |
|---|---|---|
| Cliente difícil | 3 · Alta | El cliente exige hablar con un superior |
| Aprobación | 2 · Media | Autorizar un descuento mayor al permitido |
| Duda de proceso | 1 · Baja | ¿Se puede ofrecer este plan a un cliente con mora? |

| Estado de una solicitud | Significado |
|---|---|
| Pendiente | En la cola, esperando a que un supervisor la tome |
| En atención | Un supervisor la tomó; se mide el tiempo de espera |
| Resuelta | El supervisor la cerró; se mide el tiempo de atención |

### Cuentas de prueba

En una instalación local, todas usan la contraseña `Demo-FloorHub-2026`.

| Rol | Nombre | Correo | Equipo |
|---|---|---|---|
| Agente | Santiago Ramírez | `santiago.ramirez@floorhub.com` | Retención |
| Agente | Daniela Ospina | `daniela.ospina@floorhub.com` | Retención |
| Agente | Camilo Rincón | `camilo.rincon@floorhub.com` | Retención |
| Agente | Valentina Muñoz | `valentina.munoz@floorhub.com` | Soporte técnico |
| Agente | Sebastián Cárdenas | `sebastian.cardenas@floorhub.com` | Soporte técnico |
| Agente | Mariana López | `mariana.lopez@floorhub.com` | Soporte técnico |
| Agente | Felipe Arango | `felipe.arango@floorhub.com` | Tarjetas |
| Agente | Natalia Quintero | `natalia.quintero@floorhub.com` | Tarjetas |
| Agente | Juan David Mejía | `juan.mejia@floorhub.com` | Tarjetas |

## 2. Acceso al sistema

### 2.1. Iniciar sesión

1. Abre FloorHub en el navegador (en local, <http://localhost:8080>).
2. Escribe tu correo y tu contraseña.
3. Pulsa **Entrar**. El sistema abre las páginas de tu rol.

![Pantalla de inicio de sesión](manual/capturas/01-inicio-de-sesion.png)

> Tras 10 intentos fallidos en un minuto, el acceso se bloquea temporalmente. La sesión dura un turno (8 horas); al vencer, el sistema vuelve a pedir tus datos.

Cada ventana o pestaña conserva su propia sesión, así que puedes abrir varias con usuarios distintos en el mismo navegador.

### 2.2. Cerrar sesión

Pulsa **Salir** en la esquina superior derecha. El token de la ventana se borra de inmediato.

## 3. Recorrido por la interfaz

- **Barra superior:** logo, indicador de conexión, tu nombre y rol, y el botón **Salir**.
- **Menú lateral:** una entrada por cada función de tu rol, con contadores (solicitudes en espera, comunicados por confirmar). En el celular pasa a ser una barra horizontal.
- **Indicador de conexión:** «● Disponible» significa que estás conectado y recibes los cambios al instante; «Reconectando…» indica que se perdió la conexión. Al recuperarse, la página se actualiza sola.
- **Avisos emergentes:** aparecen en la esquina inferior derecha (nuevo comunicado, recordatorio, solicitud tomada, errores).
- **Buscadores:** no distinguen tildes («munoz» encuentra «Muñoz»). En los selectores puedes usar ↑ ↓ para moverte, Enter para elegir y Esc para cerrar.

## 4. Guía del agente

### 4.1. Leer y confirmar comunicados

En **Comunicados** ves los avisos dirigidos a ti. Los críticos sin confirmar tienen borde rojo y el menú muestra cuántos te faltan.

1. Lee el comunicado completo.
2. Pulsa **Leí y entendí**.
3. El comunicado muestra la fecha y hora de tu confirmación, y tu supervisor la ve al instante.

![Comunicados del agente](manual/capturas/10-agente-comunicados.png)

> Si no confirmas un comunicado crítico recibirás recordatorios. La confirmación no se puede deshacer: queda como registro de auditoría.

### 4.2. Levantar la mano

1. Entra a **Levantar la mano**.
2. Elige el tipo: cliente difícil, aprobación o duda de proceso.
3. Escribe un resumen corto (hasta 500 caracteres).
4. Pulsa **Solicitar ayuda**.

![Formulario para pedir ayuda](manual/capturas/12-agente-levantar-la-mano.png)

Mientras esperas verás el tiempo transcurrido. Cuando un supervisor la toma, aparece su nombre y se abre una conversación: sus mensajes se muestran al instante y puedes contestarle en **Mensaje para …** con **Enviar mensaje**. Cuando el supervisor la resuelve, la conversación se cierra y la solicitud pasa a **Resueltas recientemente** con los tiempos de espera y atención.

![Solicitud pendiente con el tiempo de espera](manual/capturas/11-agente-solicitud-pendiente.png)

> Solo puedes tener una solicitud activa a la vez.

## 5. Preguntas frecuentes y solución de problemas

| Situación | Qué hacer |
|---|---|
| «Correo o contraseña incorrectos» | Revisa mayúsculas y espacios. Si sigue, pide al administrador que restablezca tu contraseña o verifique que tu usuario esté activo. |
| No puedo entrar tras varios intentos | Superaste 10 intentos en un minuto. Espera un minuto. |
| Aparece «Reconectando…» | Se perdió la conexión en vivo. Revisa tu red; al reconectar, la página se actualiza sola. |
| No puedo pedir ayuda | Ya tienes una solicitud activa. Espera a que se resuelva. |

Los términos del dominio están en el [glosario](15-glosario-tecnico.md).
