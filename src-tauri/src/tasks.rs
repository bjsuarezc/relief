// tasks.rs: la capa de "casos de uso" de tareas.
// Aquí viven los comandos Tauri que el frontend puede invocar.
// Regla del proyecto: la UI nunca habla directo con la base de datos;
// siempre pasa por estas funciones, que validan y deciden.

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::AppState;

// Las prioridades se guardan como texto en la BD (se compara fácil en SQL).
// Esta constante es la "lista blanca": si llega algo distinto, se rechaza.
const PRIORIDADES_VALIDAS: [&str; 3] = ["high", "medium", "low"];

// CreateTaskInput: lo que el frontend envía al crear una tarea.
// - Serialize: permite convertirlo a JSON (lo usamos en el payload del evento).
// - Deserialize: permite leerlo desde el JSON que manda el frontend.
// - rename_all = "camelCase": en TS los campos son dueDate/priority (camelCase);
//   aquí en Rust son due_date/priority (snake_case). Serde traduce
//   automáticamente entre ambos mundos.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaskInput {
    pub title: String,
    pub due_date: Option<String>,
    pub priority: Option<String>,
}

// Task: la tarea completa tal como la ve el frontend.
// Es la imagen espejo de la fila de la tabla `task` (ver db.rs).
// Solo tiene Serialize: hacia el frontend se sale, desde el frontend no entra.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub title: String,
    pub due_date: Option<String>,
    pub priority: String,
    pub completed: bool,
    pub completed_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

// get_tasks: devuelve TODAS las tareas, sin filtros.
// Decisión registrada en la bitácora: el frontend filtra (no optimizar antes
// de tiempo). Migrar los filtros a Rust es barato si algún día escala.
#[tauri::command]
pub fn get_tasks(state: State<AppState>) -> Result<Vec<Task>, String> {
    // El estado global es un Mutex<Connection>: una sola conexión a SQLite
    // compartida por todos los comandos. El lock evita que dos comandos
    // la usen a la vez (SQLite no maneja concurrencia de escritura bien).
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, title, due_date, priority, completed, completed_at, created_at, updated_at
             FROM task
             ORDER BY created_at",
        )
        .map_err(|e| e.to_string())?;

    // query_map recorre fila por fila y convierte cada una en un Task.
    // - completed viene como INTEGER (0/1) en SQLite; lo convertimos a bool.
    // - El "?" final de cada row.get() convierte el error de BD en error
    //   del closure; el .collect() al final junta todo en Result<Vec<Task>>.
    let tasks = stmt
        .query_map([], |row| {
            Ok(Task {
                id: row.get("id")?,
                title: row.get("title")?,
                due_date: row.get("due_date")?,
                priority: row.get("priority")?,
                completed: row.get::<_, i64>("completed")? != 0,
                completed_at: row.get("completed_at")?,
                created_at: row.get("created_at")?,
                updated_at: row.get("updated_at")?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(tasks)
}

// create_task: crea una tarea y registra el evento 'created'.
// Contrato acordado con el propietario (ver bitácora, Sesión 2):
//   create_task(input) -> Task  |  input = { title, dueDate?, priority? }
// El orden del cuerpo es: 1) validar, 2) generar datos del sistema,
// 3) escribir en la BD (fila + evento), 4) devolver la Task completa.
// set_task_completed: marca/desmarca una tarea como completada.
// Contrato acordado con el propietario (paso 4, todo opción A):
//   set_task_completed(id, completed) -> Task
// Es un "toggle" (desmarcable por clicks accidentales) e IDEMPOTENTE:
// si la tarea ya está en el estado pedido, no cambia nada ni duplica
// eventos — el segundo click es un no-op honesto.
// Registra SIEMPRE el hecho en task_event ('completed' o 'reopened'):
// el estado actual (tabla task) dice "cómo está"; el log (task_event)
// dice "qué pasó y cuándo" — la materia prima de la IA de la v2.
#[tauri::command]
pub fn set_task_completed(
    state: State<AppState>,
    id: String,
    completed: bool,
) -> Result<Task, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    // Leemos la fila ACTUAL: necesitamos su estado para 1) rechazar ids
    // que no existen (query_row devuelve QueryReturnedNoRows), y
    // 2) construir la Task final reutilizando los campos que no cambian.
    let actual = conn
        .query_row(
            "SELECT id, title, due_date, priority, completed, completed_at, created_at, updated_at
             FROM task WHERE id = ?1",
            rusqlite::params![id],
            |row| {
                Ok(Task {
                    id: row.get("id")?,
                    title: row.get("title")?,
                    due_date: row.get("due_date")?,
                    priority: row.get("priority")?,
                    completed: row.get::<_, i64>("completed")? != 0,
                    completed_at: row.get("completed_at")?,
                    created_at: row.get("created_at")?,
                    updated_at: row.get("updated_at")?,
                })
            },
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                format!("No existe una tarea con id {}", id)
            }
            _ => e.to_string(),
        })?;

    // Idempotencia: pedir lo que ya es verdad no genera UPDATE ni evento.
    if actual.completed == completed {
        return Ok(actual);
    }

    let now = chrono::Utc::now().to_rfc3339();
    // completed_at guarda CUÁNDO se completó; al desmarcar vuelve a NULL
    // (descompletar borra la marca de tiempo del completado anterior).
    let completed_at = if completed { Some(now.clone()) } else { None };

    conn.execute(
        "UPDATE task SET completed = ?1, completed_at = ?2, updated_at = ?3 WHERE id = ?4",
        rusqlite::params![completed, completed_at, now, id],
    )
    .map_err(|e| e.to_string())?;

    // Evento distinto por dirección: 'completed' (tachar) o 'reopened'
    // (desmarcar). Para la IA de la v2, "completó a las 9am" y "la reabrió"
    // son señales conductuales diferentes.
    let event_type = if completed { "completed" } else { "reopened" };
    let payload = serde_json::json!({ "completed": completed }).to_string();

    conn.execute(
        "INSERT INTO task_event (id, task_id, event_type, payload, happened_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![uuid::Uuid::new_v4().to_string(), id, event_type, payload, now],
    )
    .map_err(|e| e.to_string())?;

    // Task final: los campos que cambian van explícitos y `..actual`
    // toma el resto tal cual (sintaxis de "struct update" de Rust).
    Ok(Task {
        completed,
        completed_at,
        updated_at: now,
        ..actual
    })
}

// set_task_due_date: mueve una tarea a otro día.
// Contrato acordado con el propietario (paso 5): es el comando ÚNICO de
// reorganización — "Mover a hoy" es un caso especial (mandar la fecha de
// hoy) y "Más opciones" (elegir cualquier día) usa el mismo motor.
// Registra el evento 'rescheduled' con { de, a }: para la IA de la v2,
// cuánto y cómo se pospone una tarea es una señal conductual clave.
#[tauri::command]
pub fn set_task_due_date(
    state: State<AppState>,
    id: String,
    due_date: String,
) -> Result<Task, String> {
    // Validación de fecha igual que en create_task (cinturón de seguridad).
    chrono::NaiveDate::parse_from_str(&due_date, "%Y-%m-%d")
        .map_err(|_| format!("Fecha inválida: {}", due_date))?;

    let conn = state.0.lock().map_err(|e| e.to_string())?;

    // Leemos la fila actual: si el id no existe → error explícito; y
    // necesitamos la due_date ANTERIOR para el payload del evento.
    let actual = conn
        .query_row(
            "SELECT id, title, due_date, priority, completed, completed_at, created_at, updated_at
             FROM task WHERE id = ?1",
            rusqlite::params![id],
            |row| {
                Ok(Task {
                    id: row.get("id")?,
                    title: row.get("title")?,
                    due_date: row.get("due_date")?,
                    priority: row.get("priority")?,
                    completed: row.get::<_, i64>("completed")? != 0,
                    completed_at: row.get("completed_at")?,
                    created_at: row.get("created_at")?,
                    updated_at: row.get("updated_at")?,
                })
            },
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                format!("No existe una tarea con id {}", id)
            }
            _ => e.to_string(),
        })?;

    // Idempotencia: moverla al día donde ya está no genera UPDATE ni evento.
    if actual.due_date.as_deref() == Some(due_date.as_str()) {
        return Ok(actual);
    }

    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE task SET due_date = ?1, updated_at = ?2 WHERE id = ?3",
        rusqlite::params![due_date, now, id],
    )
    .map_err(|e| e.to_string())?;

    // { de, a } con clone(): actual se reutiliza después para la Task final,
    // y el JSON del evento necesita su propia copia de la fecha anterior.
    let payload =
        serde_json::json!({ "de": actual.due_date.clone(), "a": due_date }).to_string();

    conn.execute(
        "INSERT INTO task_event (id, task_id, event_type, payload, happened_at)
         VALUES (?1, ?2, 'rescheduled', ?3, ?4)",
        rusqlite::params![uuid::Uuid::new_v4().to_string(), id, payload, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(Task {
        due_date: Some(due_date),
        updated_at: now,
        ..actual
    })
}

// UpdateTaskInput: los campos que se pueden CORREGIR (no crear) de una
// tarea. Solo título y prioridad: la fecha tiene su propio comando
// (set_task_due_date) porque semánticamente son hechos distintos para la
// IA de la v2 — "corregí un typo" (updated) vs "pospongo la tarea"
// (rescheduled). Cada cosa, su evento.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTaskInput {
    pub title: Option<String>,
    pub priority: Option<String>,
}

// update_task: corrige título y/o prioridad de una tarea.
// Contrato (paso 6, opción B completa, minimalista): update_task(id, input)
// donde cada campo es opcional; solo se toca lo que viene.
// Idempotente como sus hermanos: si nada cambia realmente, no hay UPDATE
// ni eventos. Cada campo cambiado genera su propio evento 'updated' con
// payload { campo, de, a } — la granularidad importa para los patrones.
#[tauri::command]
pub fn update_task(
    state: State<AppState>,
    id: String,
    input: UpdateTaskInput,
) -> Result<Task, String> {
    // --- Validaciones (mismas reglas del borde que en create_task) ---
    let titulo_nuevo = input.title.map(|t| t.trim().to_string());
    if let Some(t) = &titulo_nuevo {
        if t.is_empty() {
            return Err("El título no puede estar vacío".to_string());
        }
        if t.chars().count() > 200 {
            return Err("El título no puede superar los 200 caracteres".to_string());
        }
    }
    if let Some(p) = &input.priority {
        if !PRIORIDADES_VALIDAS.contains(&p.as_str()) {
            return Err(format!("Prioridad inválida: {}", p));
        }
    }

    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let actual = conn
        .query_row(
            "SELECT id, title, due_date, priority, completed, completed_at, created_at, updated_at
             FROM task WHERE id = ?1",
            rusqlite::params![id],
            |row| {
                Ok(Task {
                    id: row.get("id")?,
                    title: row.get("title")?,
                    due_date: row.get("due_date")?,
                    priority: row.get("priority")?,
                    completed: row.get::<_, i64>("completed")? != 0,
                    completed_at: row.get("completed_at")?,
                    created_at: row.get("created_at")?,
                    updated_at: row.get("updated_at")?,
                })
            },
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                format!("No existe una tarea con id {}", id)
            }
            _ => e.to_string(),
        })?;

    // Solo cambios REALES (idempotencia): comparar contra el estado actual.
    let cambia_titulo = titulo_nuevo
        .as_ref()
        .map(|t| *t != actual.title)
        .unwrap_or(false);
    let cambia_prioridad = input
        .priority
        .as_ref()
        .map(|p| *p != actual.priority)
        .unwrap_or(false);

    if !cambia_titulo && !cambia_prioridad {
        return Ok(actual);
    }

    // Valores finales: lo que cambia toma lo nuevo; lo demás conserva.
    let titulo_final = if cambia_titulo {
        titulo_nuevo.clone().unwrap()
    } else {
        actual.title.clone()
    };
    let prioridad_final = if cambia_prioridad {
        input.priority.clone().unwrap()
    } else {
        actual.priority.clone()
    };

    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE task SET title = ?1, priority = ?2, updated_at = ?3 WHERE id = ?4",
        rusqlite::params![titulo_final, prioridad_final, now, id],
    )
    .map_err(|e| e.to_string())?;

    // Un evento 'updated' POR CAMPO cambiado (granular para la IA v2).
    // json!() construye JSON literal con valores interpolados; aquí
    // TÍTULO usa referencias (&) porque aún no se mueven.
    if cambia_titulo {
        let payload = serde_json::json!({
            "campo": "title",
            "de": actual.title,
            "a": titulo_final
        })
        .to_string();
        conn.execute(
            "INSERT INTO task_event (id, task_id, event_type, payload, happened_at)
             VALUES (?1, ?2, 'updated', ?3, ?4)",
            rusqlite::params![uuid::Uuid::new_v4().to_string(), id, payload, now],
        )
        .map_err(|e| e.to_string())?;
    }
    if cambia_prioridad {
        let payload = serde_json::json!({
            "campo": "priority",
            "de": actual.priority,
            "a": prioridad_final
        })
        .to_string();
        conn.execute(
            "INSERT INTO task_event (id, task_id, event_type, payload, happened_at)
             VALUES (?1, ?2, 'updated', ?3, ?4)",
            rusqlite::params![uuid::Uuid::new_v4().to_string(), id, payload, now],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(Task {
        title: titulo_final,
        priority: prioridad_final,
        updated_at: now,
        ..actual
    })
}

#[tauri::command]
pub fn create_task(state: State<AppState>, input: CreateTaskInput) -> Result<Task, String> {
    // --- 1. VALIDACIONES (el borde: nada de basura entra a la BD) ---

    // trim() quita espacios de los extremos: "  hola  " -> "hola".
    // Si después del trim no queda nada, el título es inválido.
    // Nota: trim() presta el texto (&str); el dueño del String sigue siendo input.
    let title = input.title.trim();
    if title.is_empty() {
        return Err("El título no puede estar vacío".to_string());
    }
    // chars().count() y no .len(): len() cuenta BYTES y un caracter con
    // acentos/emoji puede ocupar varios bytes. Aquí queremos caracteres.
    if title.chars().count() > 200 {
        return Err("El título no puede superar los 200 caracteres".to_string());
    }

    // Prioridad opcional: si no viene, "medium" es el default del MVP.
    // clone() porque después seguimos usando `input` (serializado como evento).
    let priority = input.priority.clone().unwrap_or_else(|| "medium".to_string());
    if !PRIORIDADES_VALIDAS.contains(&priority.as_str()) {
        return Err(format!("Prioridad inválida: {}", priority));
    }

    // "Cinturón de seguridad" acordado: la UI usa selector de fecha (el usuario
    // nunca escribe una), pero si por bug/fecha futura llega un string malo,
    // se rechaza aquí. NaiveDate ya sabe que el 2026-13-45 no existe.
    if let Some(due_date) = &input.due_date {
        chrono::NaiveDate::parse_from_str(due_date, "%Y-%m-%d")
            .map_err(|_| format!("Fecha inválida: {}", due_date))?;
    }

    // --- 2. DATOS QUE LA UI NO DECIDE (los genera Rust, siempre) ---

    // id: UUID v4, aleatorio y prácticamente imposible de repetir.
    let id = uuid::Uuid::new_v4().to_string();
    // now: timestamp RFC 3339 (ISO 8601 con zona UTC, ej. "2026-09-10T21:30:00Z").
    let now = chrono::Utc::now().to_rfc3339();
    // payload del evento: el input tal cual llegó, serializado a JSON.
    let event_payload = serde_json::to_string(&input).map_err(|e| e.to_string())?;

    // --- 3. ESCRITURA EN LA BD ---

    let conn = state.0.lock().map_err(|e| e.to_string())?;

    // La fila de la tarea. `?5` dos veces reutiliza `now` para
    // created_at y updated_at (al crear, ambos valen lo mismo).
    conn.execute(
        "INSERT INTO task (id, title, due_date, priority, completed, completed_at, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, 0, NULL, ?5, ?5)",
        rusqlite::params![id, title, input.due_date, priority, now],
    )
    .map_err(|e| e.to_string())?;

    // El evento 'created' en task_event (log append-only, nunca se edita).
    // Es la "memoria conductual" que usará la capa de IA de la v2:
    // captura la historia desde el día uno.
    conn.execute(
        "INSERT INTO task_event (id, task_id, event_type, payload, happened_at)
         VALUES (?1, ?2, 'created', ?3, ?4)",
        rusqlite::params![uuid::Uuid::new_v4().to_string(), id, event_payload, now],
    )
    .map_err(|e| e.to_string())?;

    // --- 4. RESPUESTA: la Task completa, tal como quedó guardada ---

    // Devolvemos la Task completa (no solo el id) para que el store la agregue
    // a la lista sin volver a pedir get_tasks (decisión del propietario).
    Ok(Task {
        id,
        title: title.to_string(),
        due_date: input.due_date,
        priority,
        completed: false,
        completed_at: None,
        created_at: now.clone(),
        updated_at: now,
    })
}
