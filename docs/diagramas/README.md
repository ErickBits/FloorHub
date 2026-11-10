# Diagramas de FloorHub

Cada diagrama está en SVG (vectorial, editable) y en PNG (para documentos y presentaciones).

| Diagrama | Archivo | Qué muestra |
|---|---|---|
| Entidad-relación | [`entidad-relacion.svg`](entidad-relacion.svg) | Modelo conceptual en notación de Chen: 5 entidades, sus atributos y las relaciones con cardinalidad. |
| Relacional | [`modelo-relacional.svg`](modelo-relacional.svg) | Las 9 tablas de PostgreSQL con columnas, tipos, PK, FK y reglas que garantiza la base. |
| Flujo general | [`flujo-general.svg`](flujo-general.svg) | Inicio de sesión, validaciones y funciones según el rol. |
| Flujo de comunicados | [`flujo-comunicados.svg`](flujo-comunicados.svg) | Publicación, confirmación y recordatorios, con carriles por actor. |
| Flujo de ayuda | [`flujo-ayuda.svg`](flujo-ayuda.svg) | Levantar la mano, tomar y resolver, con carriles por actor. |

El modelo relacional refleja `db/migrations/001_initial_schema.sql`. Si cambia el esquema, actualiza también este diagrama.

## Resto de la documentación

| Carpeta | Contenido |
|---|---|
| [`../branding`](../branding) | Logo (isotipo y horizontal, para fondo claro y oscuro), favicon y guía de marca en PDF. |
| [`../manual`](../manual) | Manual de usuario con requerimientos funcionales y no funcionales (ODT y PDF) y las capturas que usa. |
| [`../presentacion`](../presentacion) | Presentación del proyecto para LibreOffice Impress (ODP) y su versión en PDF. |
