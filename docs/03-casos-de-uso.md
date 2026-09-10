# Casos de uso — TaskLens

## CU-01: Planificar la semana

**Actor**: Usuario
**Precondición**: La app está abierta.
**Contexto**: Domingo en la noche; el usuario quiere dejar listas sus tareas de
la semana para empezar el lunes sin cargarlas en la cabeza.

**Flujo principal**:
1. El usuario abre la vista "Semana".
2. Agrega una tarea (título). La app la asigna al día indicado (por defecto: hoy/lunes).
3. Ajusta la fecha si la tarea corresponde a otro día de la semana.
4. Marca prioridad alta en las tareas que no puede postergar; deja el resto en media/baja.
5. Repite 2-4 hasta tener la semana cargada.
6. Cierra la app con tranquilidad: el plan está guardado.

**Flujos alternativos**:
- Si una tarea no tiene un día fijo, la deja sin fecha (queda como anotación).

**RF cubiertos**: RF-01 (captura), RF-02 (fecha), RF-03 (prioridad), RF-06 (vista semana), RF-09 (persistencia).

---

## CU-02: Día normal

**Actor**: Usuario
**Precondición**: La app está abierta. Existen tareas con fecha de hoy.
**Contexto**: Media mañana; el usuario abre la app para saber qué hacer primero.

**Flujo principal**:
1. El usuario abre la vista "Hoy".
2. Ve sus tareas ordenadas por prioridad (alta → media → baja).
3. Completa la primera tarea alta → la tacha y desaparece de "pendientes"
   (queda visible pero atenuada, como micro-victoria).
4. Sigue con la siguiente. A lo largo del día repite el paso 3.
5. Al final del día, la vista muestra su progreso (tachadas vs. pendientes).

**Flujos alternativos**:
- Una tarea quedó sin completar: sigue pendiente mañana (o se edita su fecha).
- La tarea ya no aplica: el usuario la elimina (RF-08a) y la lista queda limpia.
- Ninguna tarea está completada todavía: la vista no genera presión, muestra
  la lista limpia ordenada por prioridad.

**RF cubiertos**: RF-05 (vista hoy), RF-04 (completar/desmarcar), RF-03 (orden por prioridad), RF-07 (edición de fecha al reprogramar), RF-08a (eliminar pendiente).

---

## CU-03: Captura durante el día

**Actor**: Usuario
**Precondición**: La app está abierta (o accesible con un atajo).
**Contexto**: El usuario recuerda algo que debe hacer mientras trabaja;
no quiere perder el foco anotándolo.

**Flujo principal**:
1. El usuario enfoca el input de captura (atajo de teclado o click).
2. Escribe el título y presiona Enter → la tarea queda registrada para hoy, prioridad media.
3. Vuelve a lo que estaba haciendo en ~5 segundos.

**Flujos alternativos**:
- La tarea es para otro día: la asigna a una fecha en la misma captura.
- Es urgente: marca prioridad alta en el mismo paso de captura.

**RF cubiertos**: RF-01 (≤ 3 interacciones), RF-02, RF-03.

---

## CU-04: Repaso matinal

**Actor**: Usuario
**Precondición**: La app está abierta. Existen tareas vencidas (fecha anterior a hoy).
**Contexto**: El usuario abre la app en la mañana y hay tareas de días anteriores
sin completar. Este momento es donde más ansiedad genera una lista de tareas:
aquí la app debe comunicar control, no retraso.

**Flujo principal**:
1. El usuario abre la vista "Hoy".
2. Encima de las tareas de hoy ve la sección "Atrasadas", con el conteo de
   tareas pendientes de días anteriores (sin estética de alarma ni fechas rojas).
3. Tarea por tarea decide:
   - **"Mover a hoy"** (un click) si la hace hoy.
   - **"Más opciones"** si prefiere distribuirlas: mueve algunas a un día
     específico de la semana, o les quita la fecha.
   - También puede editar la fecha manualmente si el día exacto importa.
4. En menos de un minuto tiene un plan limpio para el día; la ansiedad de
   "tengo cosas atrasadas" se convierte en "tengo un plan".

**Flujos alternativos**:
- La tarea atrasada ya no aplica: se elimina (RF-08a).
- Hay muchas tareas atrasadas: vía "Más opciones", las distribuye a lo largo
  de la semana (distribuye la carga en lugar de arrastrarla toda a hoy).

**RF cubiertos**: RF-15 (sección atrasadas + "Mover a hoy" + "Más opciones"), RF-07 (edición), RF-08a (eliminar).

---

## Verificación de cobertura RF ↔ CU

| RF | CU-01 | CU-02 | CU-03 | CU-04 | Estado |
|----|:-----:|:-----:|:-----:|:-----:|--------|
| RF-01 Captura rápida | ✓ | – | ✓ | – | Cubierto |
| RF-02 Fecha | ✓ | – | ✓ | ✓ | Cubierto |
| RF-03 Prioridad | ✓ | ✓ | ✓ | – | Cubierto |
| RF-04 Completar/desmarcar | – | ✓ | – | – | Cubierto |
| RF-05 Vista Hoy | – | ✓ | – | ✓ | Cubierto |
| RF-06 Vista Semana | ✓ | – | – | – | Cubierto |
| RF-07 Edición | ✓ | ✓ | – | ✓ | Cubierto |
| RF-08a Eliminar pendientes | – | ✓ | – | ✓ | Cubierto |
| RF-08b Historial de completadas | – | ✓ | – | – | Cubierto |
| RF-15 Tareas atrasadas | – | – | – | ✓ | Cubierto |
| RF-09 Persistencia | ✓ | – | ✓ | ✓ | Cubierto |

Cobertura completa: todos los RF del MVP aparecen al menos en un caso de uso.
RF-08b (no eliminar completadas) es una decisión de diseño que se refleja en
la ausencia de cualquier flujo de eliminación de tareas completadas.
