# Documentación de FloorHub

Documentación técnica y funcional de **FloorHub**, la plataforma interna para el piso de operaciones de un BPO: comunicados con confirmación de lectura auditable y cola de ayuda con un único responsable.

Todo lo que dice esta documentación sale del código del repositorio (versión del 10/11/2026). Las 42 pruebas automáticas se ejecutaron ese día y todas fueron aprobadas.

## Cómo leerla

| Si eres… | Empieza por |
|---|---|
| Usuario de la aplicación | [13 · Manual de usuario](13-manual-de-usuario.md) |
| Jurado o evaluador | [01 · Requerimientos](01-especificacion-requerimientos-ieee830.md), [02 · Arquitectura](02-arquitectura-software-c4-y-backend.md) y [16 · Guion de sustentación](16-guion-demostracion-sustentacion.md) |
| Quien instala o despliega | [06 · Manual técnico](06-manual-tecnico-instalacion-y-despliegue.md) y [17 · Diseño técnico y costos](17-diseno-tecnico-y-costos.md) |
| Desarrollador nuevo | [18 · Guía por fases](18-guia-por-fases.md), [02 · Arquitectura](02-arquitectura-software-c4-y-backend.md) y [04 · Base de datos](04-base-de-datos-diseno-y-esquema.md) |

## Documentos

### Análisis y requerimientos

| N.º | Documento | Contenido |
|---|---|---|
| 01 | [Especificación de requerimientos (IEEE 830)](01-especificacion-requerimientos-ieee830.md) | Problema, objetivos, alcance, 25 RF, 21 RNF, historias de usuario en Gherkin y trazabilidad |
| 07 | [Reglas de negocio y pruebas](07-reglas-de-negocio-y-pruebas.md) | 20 reglas de negocio, algoritmos y los 42 casos de prueba automáticos |
| 10 | [Casos de uso](10-casos-de-uso.md) | Actores, diagramas, 19 casos de uso y su especificación |
| 15 | [Glosario técnico](15-glosario-tecnico.md) | Términos del BPO y técnicos, catálogos, límites y fórmulas |

### Diseño

| N.º | Documento | Contenido |
|---|---|---|
| 02 | [Arquitectura de software, C4 y backend](02-arquitectura-software-c4-y-backend.md) | Contexto, contenedores, componentes, despliegue en AWS, endpoints y eventos WebSocket |
| 03 | [Arquitectura del frontend y roles](03-arquitectura-frontend-y-roles.md) | React, estructura, RBAC, reglas de visibilidad y accesibilidad |
| 04 | [Base de datos: diseño y esquema](04-base-de-datos-diseno-y-esquema.md) | Modelo relacional, diccionario de datos, índices, triggers y permisos |
| 08 | [Modelo entidad-relación](08-modelo-entidad-relacion.md) | Diagramas ER, cardinalidades y justificación del diseño |
| 09 | [Mapa de navegación](09-mapa-de-navegacion.md) | Páginas por rol, rutas, llamadas a la API y eventos en vivo |
| 11 | [Diagrama de clases](11-diagrama-de-clases.md) | Modelo de dominio y arquitectura por capas |
| 12 | [Diagramas de secuencia](12-diagramas-de-secuencia.md) | Login, publicar, confirmar, tomar solicitud y recordatorios |
| 17 | [Diseño técnico y costos](17-diseno-tecnico-y-costos.md) | Decisiones de arquitectura, Redis, dimensionamiento, infraestructura AWS y costos detallados |

### Calidad, seguridad y operación

| N.º | Documento | Contenido |
|---|---|---|
| 05 | [Políticas de seguridad, resiliencia y calidad](05-politicas-seguridad-resiliencia-y-calidad.md) | ISO 25010, IAM, Ley 1581, recuperación ante fallos y OWASP API Top 10 |
| 06 | [Manual técnico de instalación y despliegue](06-manual-tecnico-instalacion-y-despliegue.md) | Docker Compose, variables de entorno, minikube, AWS, CI/CD y solución de problemas |
| 14 | [Plan y reporte de pruebas (ISO 25010)](14-plan-y-reporte-de-pruebas-iso25010.md) | Estrategia, reporte de ejecución, plan de pruebas manuales y trazabilidad |
| 18 | [Guía por fases](18-guia-por-fases.md) | Qué se construyó en cada fase, cómo probarlo y qué aprender |

### Usuario y sustentación

| N.º | Documento | Contenido |
|---|---|---|
| 13 | [Manual de usuario](13-manual-de-usuario.md) | Guía por rol con capturas de pantalla |
| 16 | [Guion de demostración para la sustentación](16-guion-demostracion-sustentacion.md) | Lista de chequeo, 5 escenarios y preguntas frecuentes del jurado |

## Carpetas

| Carpeta | Contenido |
|---|---|
| [`api/`](api) | `openapi_floorhub.yaml`: contrato OpenAPI 3.0.3 de los 24 endpoints |
| [`requerimientos/`](requerimientos) | `Matriz_de_requerimientos_FloorHub.xlsx`: hojas RF, RNF, Trazabilidad (RF × CU × clases), RN y RI, y Control de cambios |
| [`diagramas/`](diagramas) | 22 diagramas (C4, despliegue, casos de uso, clases, secuencia, estados, navegación, ER, relacional y flujos), con sus fuentes en [`diagramas/fuentes`](diagramas/fuentes) |
| [`manual/`](manual) | Manual de usuario maquetado (ODT y PDF) y las 14 capturas que usan el PDF y el documento 13 |
| [`presentacion/`](presentacion) | Presentación del proyecto para LibreOffice Impress (ODP) y su versión en PDF |
| [`branding/`](branding) | Logo (isotipo y horizontal, para fondo claro y oscuro), favicon y guía de marca en PDF |

## Mantener la documentación al día

| Si cambia… | Actualiza… |
|---|---|
| `db/migrations/*.sql` | 04, 08, `diagramas/fuentes/der.mmd`, `clases_dominio.mmd` y el modelo relacional |
| Una ruta de `apps/api/src/routes` | 02 (catálogo de endpoints), 09 y `api/openapi_floorhub.yaml` |
| Una prueba en `apps/*/test` | 07 y 14 |
| Una pantalla de `apps/web` | 03, 09, 13, las capturas y el manual en ODT |
| Un requisito | 01, 10, la matriz de Excel y el manual en ODT |
| La infraestructura o los precios de AWS | 06 y 17 |
