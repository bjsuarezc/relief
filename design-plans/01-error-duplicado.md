# Plan 1 — Error de creación mostrado una sola vez

**Origen**: auditoría improve-ui (commit de referencia `5c41d5a`). Finding #1, seleccionado por el propietario.

## Contexto del ejecutor

Relief es una app de escritorio de tareas (Tauri + React + TS). El frontend
mantiene el estado en `src/lib/store.ts` (Zustand). Los errores de los
comandos Rust se guardan en el campo `error` del store; la UI decide cómo
mostrarlos.

**Decisión que gobierna esta corrección** (bitácora Sesión 2, paso 1):
el store guarda los errores "sin lanzar" y "la UI decide cómo avisar".
Mostrar el mismo mensaje en DOS lugares de la pantalla a la vez contradice
ese contrato de presentación única.

## Problema

Cuando una acción falla (ej. un comando Rust devuelve error), el mensaje se
renderiza dos veces:

1. `src/App.tsx:26` — `{error && <p className="mt-6 text-sm text-red-400">{error}</p>}`
   renderiza SIEMPRE el `error` del store.
2. `src/components/CaptureBar.tsx:90` — `setCaptureError(useTasksStore.getState().error)`
   copia el mismo `error` del store al estado local `captureError`, que se
   renderiza debajo del input (CaptureBar, línea final del JSX).

El usuario ve el mismo texto en rojo dos veces: bajo el input Y más abajo.

## Corrección única

CaptureBar deja de duplicar el error del store: el mensaje de fallos de
comandos lo muestra App (una sola vez). CaptureBar conserva su propio
mensaje SOLO para el caso de validación local "título vacío", que el store
nunca ve (el frontend lo bloquea antes de invocar).

## Pasos

1. Abrir `src/components/CaptureBar.tsx`.
2. Localizar el bloque (líneas ~85-92):

```tsx
    const created = useTasksStore.getState().tasks.length > tasksBefore;
    if (created) {
      setTitle("");
      setCaptureError(null);
    } else {
      setCaptureError(useTasksStore.getState().error);
    }
    inputRef.current?.focus();
```

3. Reemplazar por:

```tsx
    const created = useTasksStore.getState().tasks.length > tasksBefore;
    if (created) {
      setTitle("");
      setCaptureError(null);
    }
    inputRef.current?.focus();
```

(Se elimina solo la rama `else` que copia el error del store. La detección
de "no se creó" sigue funcionando vía el conteo de tareas — el título NO se
limpia si falló. El mensaje ahora lo muestra App.tsx:26, inmediatamente
debajo.)

4. Verificar que la anotación del bloque explique la delegación (ajustar
   el comentario para decir: "si falló, el texto no se limpia; el mensaje
   lo muestra App con el error del store — un solo lugar").

## Verificación

- `npm run build` debe pasar (tsc estricto).
- Prueba manual: captura con título vacío → mensaje propio de CaptureBar
  ("Escribe una tarea antes de crearla"), UNA sola vez.
- Prueba manual: crear una tarea normal → sin mensajes.
- El caso de fallo real de BD solo ocurre con el comando caído; la prueba
  de código es la evidencia principal (la rama eliminada era la única
  fuente del duplicado).

## Fuera de alcance

- Estilo del mensaje de App (posición, tamaño).
- Cambiar cómo el store guarda los errores.
