# Diagramas de FloorHub

Hay dos familias de diagramas:

1. **Diagramas de modelo y de flujo**, dibujados a mano en SVG. Cada uno está en SVG (vectorial, editable) y en PNG (para documentos y presentaciones).
2. **Diagramas de arquitectura y UML**, escritos en Mermaid. Su fuente está en [`fuentes/`](fuentes) (`.mmd`) y se renderizan a PNG.

Los 22 diagramas tienen además una página en Markdown para la wiki de Taiga en [`taiga/`](taiga): tablas con el contenido del diagrama y la imagen enlazada desde GitHub. Taiga no dibuja Mermaid, por eso la página usa el PNG. Las imágenes solo se ven después de hacer push a `main`.

## 1. Modelo y flujos (SVG)

| Diagrama | Archivo | Qué muestra |
|---|---|---|
| Entidad-relación | [`entidad-relacion.svg`](entidad-relacion.svg) | Modelo conceptual en notación de Chen: 5 entidades, sus atributos y las relaciones con cardinalidad. |
| Relacional | [`modelo-relacional.svg`](modelo-relacional.svg) | Las 9 tablas de PostgreSQL con columnas, tipos, PK, FK y reglas que garantiza la base. |
| Flujo general | [`flujo-general.svg`](flujo-general.svg) | Inicio de sesión, validaciones y funciones según el rol. |
| Flujo de comunicados | [`flujo-comunicados.svg`](flujo-comunicados.svg) | Publicación, confirmación y recordatorios, con carriles por actor. |
| Flujo de ayuda | [`flujo-ayuda.svg`](flujo-ayuda.svg) | Levantar la mano, tomar y resolver, con carriles por actor. |

El modelo relacional refleja `db/migrations/001_initial_schema.sql`. Si cambia el esquema, actualiza también este diagrama.

## 2. Arquitectura y UML (Mermaid)

| Diagrama | Imagen | Fuente | Se usa en |
|---|---|---|---|
| C4 · Contexto | [`c4_contexto.png`](c4_contexto.png) | [`c4_contexto.mmd`](fuentes/c4_contexto.mmd) | [02](../02-arquitectura-software-c4-y-backend.md) |
| C4 · Contenedores | [`c4_contenedores.png`](c4_contenedores.png) | [`c4_contenedores.mmd`](fuentes/c4_contenedores.mmd) | [02](../02-arquitectura-software-c4-y-backend.md) |
| C4 · Componentes de la API | [`c4_componentes_api.png`](c4_componentes_api.png) | [`c4_componentes_api.mmd`](fuentes/c4_componentes_api.mmd) | [02](../02-arquitectura-software-c4-y-backend.md) |
| Despliegue en AWS | [`despliegue_aws.png`](despliegue_aws.png) | [`despliegue_aws.mmd`](fuentes/despliegue_aws.mmd) | [02](../02-arquitectura-software-c4-y-backend.md) |
| Casos de uso · Agente | [`cu_agente.png`](cu_agente.png) | [`cu_agente.mmd`](fuentes/cu_agente.mmd) | [10](../10-casos-de-uso.md) |
| Casos de uso · Supervisor | [`cu_supervisor.png`](cu_supervisor.png) | [`cu_supervisor.mmd`](fuentes/cu_supervisor.mmd) | [10](../10-casos-de-uso.md) |
| Casos de uso · Administrador | [`cu_administracion.png`](cu_administracion.png) | [`cu_administracion.mmd`](fuentes/cu_administracion.mmd) | [10](../10-casos-de-uso.md) |
| Clases · Dominio | [`clases_dominio.png`](clases_dominio.png) | [`clases_dominio.mmd`](fuentes/clases_dominio.mmd) | [11](../11-diagrama-de-clases.md) |
| Clases · Capas | [`clases_capas.png`](clases_capas.png) | [`clases_capas.mmd`](fuentes/clases_capas.mmd) | [11](../11-diagrama-de-clases.md) |
| Secuencia · Iniciar sesión | [`sec_login.png`](sec_login.png) | [`sec_login.mmd`](fuentes/sec_login.mmd) | [12](../12-diagramas-de-secuencia.md) |
| Secuencia · Publicar comunicado | [`sec_publicar_comunicado.png`](sec_publicar_comunicado.png) | [`sec_publicar_comunicado.mmd`](fuentes/sec_publicar_comunicado.mmd) | [12](../12-diagramas-de-secuencia.md) |
| Secuencia · Confirmar lectura | [`sec_confirmar.png`](sec_confirmar.png) | [`sec_confirmar.mmd`](fuentes/sec_confirmar.mmd) | [12](../12-diagramas-de-secuencia.md) |
| Secuencia · Tomar solicitud | [`sec_tomar_solicitud.png`](sec_tomar_solicitud.png) | [`sec_tomar_solicitud.mmd`](fuentes/sec_tomar_solicitud.mmd) | [12](../12-diagramas-de-secuencia.md) |
| Secuencia · Recordatorios | [`sec_recordatorios.png`](sec_recordatorios.png) | [`sec_recordatorios.mmd`](fuentes/sec_recordatorios.mmd) | [12](../12-diagramas-de-secuencia.md) |
| Estados de una solicitud | [`estados_solicitud.png`](estados_solicitud.png) | [`estados_solicitud.mmd`](fuentes/estados_solicitud.mmd) | [04](../04-base-de-datos-diseno-y-esquema.md), [12](../12-diagramas-de-secuencia.md) |
| Mapa de navegación | [`mapa_navegacion.png`](mapa_navegacion.png) | [`mapa_navegacion.mmd`](fuentes/mapa_navegacion.mmd) | [03](../03-arquitectura-frontend-y-roles.md), [09](../09-mapa-de-navegacion.md) |
| Entidad-relación (patas de gallo) | [`der.png`](der.png) | [`der.mmd`](fuentes/der.mmd) | [04](../04-base-de-datos-diseno-y-esquema.md), [08](../08-modelo-entidad-relacion.md) |

### Volver a generar las imágenes

Desde esta carpeta:

```bash
for f in fuentes/*.mmd; do
  npx -y @mermaid-js/mermaid-cli -c fuentes/_config.json -b white -s 2 -i "$f" -o "$(basename "$f" .mmd).png"
done
```

`fuentes/_config.json` aplica los colores de la marca. Dentro de un mensaje de un diagrama de secuencia no uses `;`: Mermaid lo interpreta como fin de instrucción.

## Resto de la documentación

El índice completo está en [`../README.md`](../README.md).
