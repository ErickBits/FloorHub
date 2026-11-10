# Mapa de Navegación — FloorHub

## 1. Diagrama general

Después de iniciar sesión, cada rol entra a una vista distinta con su propio menú lateral. No hay páginas compartidas entre roles, salvo el inicio de sesión.

![Mapa de navegación](diagramas/mapa_navegacion.png)

## 2. Diagramas por sección (se dibujan en GitHub)

### 2.1. Agente

```mermaid
flowchart LR
    L["Inicio de sesión"] --> C["Comunicados<br/>#/comunicados"]
    C <--> H["Levantar la mano<br/>#/ayuda"]
    C -->|"Leí y entendí"| C
    H -->|"Solicitar ayuda"| H
    C & H -->|"Salir"| L
```

### 2.2. Supervisor

```mermaid
flowchart LR
    L["Inicio de sesión"] --> Q["Cola de ayuda<br/>#/cola"]
    Q <--> P["Presencia<br/>#/presencia"]
    Q <--> N["Nuevo comunicado<br/>#/comunicados/nuevo"]
    N -->|"Publicar"| PUB["Comunicados publicados<br/>#/comunicados"]
    PUB -->|"desplegar"| D["Confirmados y pendientes"]
    Q -->|"Tomar / Resolver"| Q
    Q & P & N & PUB -->|"Salir"| L
```

### 2.3. Administrador

```mermaid
flowchart LR
    L["Inicio de sesión"] --> U["Listado de usuarios<br/>#/usuarios"]
    U --> UN["Agregar usuario<br/>#/usuarios/nuevo"] -->|"Crear usuario"| U
    U --> UE["Editar usuario<br/>#/usuarios/{id}"] -->|"Guardar cambios"| U
    U <--> C["Listado de campañas<br/>#/campanas"]
    C --> CN["Agregar campaña<br/>#/campanas/nueva"] --> C
    C --> CE["Editar campaña<br/>#/campanas/{id}"] --> C
    U <--> E["Listado de equipos<br/>#/equipos"]
    E --> EN["Agregar equipo<br/>#/equipos/nuevo"] -->|"Crear equipo"| EE
    E --> EE["Editar equipo<br/>#/equipos/{id}"]
    EE -->|"enlace de un agente"| UE
```

Al crear un equipo, la aplicación abre directamente su página de edición para asignarle supervisores.

## 3. Inventario de rutas

| Rol | Ruta | Página | Llamadas a la API |
|---|---|---|---|
| Todos | (sin hash) | Inicio de sesión | `POST /auth/login`, `GET /auth/me` |
| Agente | `#/comunicados` | Comunicados | `GET /announcements`, `POST /announcements/{id}/ack` |
| Agente | `#/ayuda` | Levantar la mano | `GET /help-requests`, `POST /help-requests` |
| Supervisor | `#/cola` | Cola de ayuda | `GET /help-requests`, `POST /help-requests/{id}/claim`, `POST /help-requests/{id}/resolve` |
| Supervisor | `#/presencia` | Presencia | `GET /presence` |
| Supervisor | `#/comunicados/nuevo` | Nuevo comunicado | `GET /directory`, `POST /announcements` |
| Supervisor | `#/comunicados` | Comunicados publicados | `GET /announcements`, `GET /announcements/{id}/status` |
| Admin | `#/usuarios` | Listado de usuarios | `GET /admin/users`, `GET /admin/teams`, `GET /admin/campaigns` |
| Admin | `#/usuarios/nuevo` | Agregar usuario | `POST /admin/users` |
| Admin | `#/usuarios/{id}` | Editar usuario | `PATCH /admin/users/{id}` |
| Admin | `#/campanas`, `#/campanas/nueva`, `#/campanas/{id}` | Campañas | `POST /admin/campaigns`, `PATCH /admin/campaigns/{id}` |
| Admin | `#/equipos`, `#/equipos/nuevo` | Equipos | `POST /admin/teams` |
| Admin | `#/equipos/{id}` | Editar equipo | `PATCH /admin/teams/{id}`, `PUT /admin/teams/{id}/supervisors` |

La vista del supervisor carga la cola, la presencia y el directorio a la vez al conectar, para que los contadores del menú estén al día en cualquier página.

## 4. Eventos en vivo por página

| Página | Eventos que la actualizan sin recargar |
|---|---|
| Agente · Comunicados | `announcement:new`, `announcement:reminder` |
| Agente · Levantar la mano | `help:created`, `help:claimed`, `help:resolved` |
| Supervisor · Cola de ayuda | `help:created`, `help:claimed`, `help:resolved` |
| Supervisor · Presencia | `presence:changed` |
| Supervisor · Comunicados publicados | `announcement:published`, `announcement:acknowledged` |

## 5. Observaciones de navegación

- **Enrutado por hash.** Cambiar de página no recarga el documento ni requiere reglas en Nginx, y cada ventana conserva su página.
- **Rutas desconocidas.** Si la ruta no existe para el rol, se abre la página por defecto: `#/comunicados` (agente), `#/cola` (supervisor) o `#/usuarios` (administrador).
- **Una página por función.** Las tareas frecuentes quedan a un clic en el menú lateral, agrupado en secciones («Piso» y «Comunicados» para el supervisor; «Usuarios», «Campañas» y «Equipos» para el administrador).
- **Sesión vencida.** Cualquier respuesta 401 devuelve al inicio de sesión desde cualquier página.
- **Pantallas pequeñas.** Por debajo de 860 px, el menú lateral se vuelve horizontal.
