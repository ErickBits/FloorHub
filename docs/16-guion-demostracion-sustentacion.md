# Guion de Demostración en Vivo para la Sustentación

## 1. Ficha técnica de la presentación

| Dato | Valor |
|---|---|
| Proyecto | FloorHub: comunicados con confirmación y cola de ayuda para el piso de un BPO |
| Autor | Erick Santiago Tamayo Garcia |
| Duración sugerida | 15 minutos de demo + 10 de preguntas |
| Entorno | AWS (EKS) o, como respaldo, local con `make up` |
| Navegador | Un navegador con 4 ventanas (cada una con su sesión) |
| Presentación de apoyo | [presentacion/FloorHub.odp](presentacion/FloorHub.odp) |

## 2. Lista de chequeo previa

**El día anterior o 2 horas antes**

- [ ] `make cost-check` limpio y despliegue con `make deploy` (15 a 25 minutos).
- [ ] `make demo-password` y anotar la contraseña.
- [ ] `kubectl -n floorhub get pods,hpa`: todo en `Running`.
- [ ] Respaldo local probado: `make reset && make up` y login en <http://localhost:8080>.

**15 minutos antes**

- [ ] Abrir 4 ventanas e iniciar sesión en cada una:

| Ventana | Usuario | Rol |
|---|---|---|
| 1 | `laura.gomez@floorhub.com` | Supervisora de Retención |
| 2 | `santiago.ramirez@floorhub.com` | Agente de Retención |
| 3 | `daniela.ospina@floorhub.com` | Agente de Retención |
| 4 | `andres.morales@floorhub.com` | Administrador |

- [ ] Verificar el indicador «● Disponible» en las ventanas 1, 2 y 3.
- [ ] Tener una terminal abierta en el repositorio para la prueba de concurrencia y el reinicio de Redis.

## 3. Escenario 1: el problema y la presencia (2 min)

1. Explicar los dos problemas: los agentes se enteran tarde de los cambios y las solicitudes de ayuda se pierden en chats.
2. En la ventana de **Laura**, abrir **Presencia**: Santiago y Daniela aparecen conectados (`2/3`).
3. Cerrar y volver a abrir la ventana de Daniela: Laura la ve desconectarse y reconectarse en vivo.

**Mensaje clave:** el supervisor sabe en todo momento quién está en el piso.

## 4. Escenario 2: comunicado crítico con confirmación (4 min)

1. Laura → **Nuevo comunicado**: título «Cambio en la tarifa de retención», prioridad **Crítico**, recordatorio cada **1 minuto**, destino equipo **Retención**. Pulsar **Publicar**.
2. Mostrar que llega **al instante** a Santiago y a Daniela, con un aviso emergente.
3. Laura → **Comunicados publicados**: desplegar el comunicado, 0 %.
4. Santiago pulsa **Leí y entendí**: el porcentaje sube a 50 % sin recargar.
5. Esperar un minuto: **solo Daniela** recibe «Recordatorio: confirma…». Santiago no.
6. Daniela confirma: 100 % y los recordatorios se detienen.

**Mensaje clave:** la confirmación es una prueba de auditoría. Mostrar en la terminal que ni siquiera el dueño de la base puede borrarla:

```bash
docker compose exec postgres psql -U floorhub_owner -d floorhub -c "DELETE FROM announcement_acks;"
# ERROR: announcement_acks es un registro de auditoría y no se puede modificar
```

El trigger de `DELETE` actúa por fila, así que hazlo después de que alguien haya confirmado. Este comando es para la demo local; en AWS la base está en subredes privadas.

## 5. Escenario 3: cola de ayuda y concurrencia (4 min)

1. Daniela → **Levantar la mano**: tipo **Cliente difícil**, resumen «El cliente exige hablar con un superior». Pulsar **Solicitar ayuda**.
2. La solicitud aparece en la **Cola de ayuda** de Laura con prioridad alta y el tiempo de espera corriendo.
3. Daniela intenta pedir otra: «Ya tienes una solicitud activa».
4. Laura pulsa **Tomar**: Daniela ve «En atención» con el nombre de Laura.
5. Laura pulsa **Resolver**: la solicitud pasa a «Resueltas (24 h)» con los tiempos de espera y atención.
6. **Concurrencia:** ejecutar la prueba de los 10 supervisores simultáneos:

```bash
npx vitest run apps/api/test/helpRequests.test.js -t "dos supervisores"
```

Explicar: 10 peticiones al mismo tiempo, 1 gana y 9 reciben 409, gracias al `UPDATE … WHERE status = 'pending'` y al bloqueo de fila de PostgreSQL, sin candados en Redis.

## 6. Escenario 4: administración (2 min)

1. Andrés → **Listado de usuarios**: buscar «munoz» y encontrar a Valentina Muñoz (buscador sin tildes).
2. **Editar** a Camilo Rincón y desmarcar **Usuario activo**. Explicar que no se borra, para conservar el historial, y que pierde el acceso de inmediato.
3. **Listado de equipos** → editar **Retención** y mostrar la asignación de supervisores con buscador.

## 7. Escenario 5: resiliencia y calidad (3 min)

1. Publicar otro comunicado crítico y reiniciar Redis:

   ```bash
   docker compose restart redis          # local
   kubectl -n floorhub delete pod -l app=redis   # en AWS
   ```

   Las ventanas muestran «Reconectando…», vuelven solas y el recordatorio llega igual gracias al reconciliador.
2. En AWS, borrar un pod del gateway: `kubectl -n floorhub delete pod -l app=gateway`. Los clientes reconectan a la otra réplica.
3. Mostrar la suite completa:

   ```bash
   npx vitest run
   # Test Files  5 passed (5)
   #      Tests  42 passed (42)
   ```

## 8. Banco de preguntas frecuentes del jurado

| Pregunta | Respuesta |
|---|---|
| ¿Por qué PostgreSQL y no solo Redis? | PostgreSQL es la fuente de verdad: transacciones, restricciones y auditoría. Redis acelera y coordina, pero todo lo suyo se reconstruye desde PostgreSQL. |
| ¿Qué pasa si dos supervisores pulsan «Tomar» a la vez? | PostgreSQL bloquea la fila. El segundo `UPDATE` vuelve a evaluar el `WHERE`, encuentra la solicitud ya tomada y actualiza 0 filas; la API responde 409. Lo prueba un test con 10 peticiones simultáneas. |
| ¿Cómo garantizan que una confirmación no se altere? | Tres capas: el rol de la aplicación no tiene permiso de `UPDATE` ni `DELETE`, triggers que lo rechazan incluso al dueño, y contenido del comunicado inmutable. |
| ¿Y si un agente se cambia de equipo? | La audiencia se guarda como foto fija al publicar; el porcentaje y la auditoría no cambian. |
| ¿Por qué la prioridad no la elige el agente? | Si la eligiera, todo sería urgente. El servidor la asigna según el tipo. |
| ¿Cómo funciona el tiempo real con varias réplicas? | La API publica en Redis y cada réplica del gateway entrega a sus propios clientes. Solo se usa WebSocket para no necesitar sesiones pegajosas. |
| ¿Qué pasa si Redis se cae? | La API responde desde PostgreSQL (`degraded`), los clientes reconectan y recargan por REST, y el reconciliador reencola los recordatorios en menos de un minuto. |
| ¿Por qué `sessionStorage` y no cookies? | Permite una sesión por ventana. El riesgo ante XSS se mitiga con React, que escapa el contenido, y una CSP estricta. |
| ¿Cuánto cuesta en AWS? | Unos 0,26 USD por hora; el proyecto completo estima 8,16 USD frente a un límite de 30 USD. El riesgo real es olvidar destruir, por eso existen `make destroy`, `make cost-check` y alertas de presupuesto. |
| ¿Por qué no usaron Spot? | Ahorraría unos 1,57 USD, pero AWS podría retirar un nodo en plena presentación. |
| ¿Qué limitaciones tiene? | HTTPS con un nombre de sslip.io en lugar de un dominio propio, Redis y RDS sin alta disponibilidad por costo, y un superusuario podría desactivar los triggers. Están documentadas con su alternativa. |
| ¿Cómo prueban sin mocks? | Las pruebas corren contra PostgreSQL y Redis reales en Docker, con una base exclusiva que se crea y destruye en cada ejecución. |

## 9. Conclusión de la sustentación

FloorHub resuelve dos problemas reales del piso de un BPO con garantías verificables:

- **Comunicados:** entrega en vivo, confirmación auditable que nadie puede alterar y recordatorios que sobreviven a un reinicio de Redis.
- **Cola de ayuda:** prioridad justa, un único responsable incluso con clics simultáneos y tiempos medidos.
- **Calidad:** 42 pruebas automáticas contra servicios reales, CI en cada cambio y despliegue reproducible en Kubernetes por menos de 10 USD.

## 10. Al terminar: destruir el mismo día

```bash
make destroy      # debe terminar con «Todo limpio»
make cost-check
```

Revisar al día siguiente la sección *Billing* de AWS, porque los datos llegan con retraso.
