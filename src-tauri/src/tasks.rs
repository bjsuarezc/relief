// tasks.rs: la capa de "casos de uso" de tareas.
//
// Aquí viven los comandos Tauri que el frontend puede invocar.
// Regla del proyecto: la UI nunca habla directo con la base de datos;
// siempre pasa por estas funciones, que validan y deciden.
//
// ORGANIZACIÓN (por testabilidad):
// - `*_tarea` / `listar_tareas` / `vaciar_papelera`: la LÓGICA. Reciben
//   `&Connection` — no saben nada de Tauri. Se pueden testear con una BD
//   en memoria (ver el módulo de tests al final del archivo).
// - Los comandos `#[tauri::command]` son ENVOLTORIOS finos: toman el estado
//   global, sacan la conexión del Mutex y delegan en la lógica.
//   Este patrón se llama inversión de dependencia: la lógica no depende del
//   framework, y por eso es testeable.

use rusqlite::Connection;
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
    pub deleted_at: Option<String>,
}

// Columnas de `task` en un solo lugar: las comparten la lectura individual
// y la lista completa (si se agrega una columna, se agrega acá).
const COLUMNAS_TASK: &str =
    "id, title, due_date, priority, completed, completed_at, created_at, updated_at, deleted_at";

// Helper interno: convierte una fila de la tabla task en un Task.
// Una sola fuente de verdad del mapeo (mismo principio que PRIORIDADES en
// el frontend: no duplicar): 4 comandos hacían este mapeo a mano.
fn task_de_fila(row: &rusqlite::Row) -> rusqlite::Result<Task> {
    Ok(Task {
        id: row.get("id")?,
        title: row.get("title")?,
        due_date: row.get("due_date")?,
        priority: row.get("priority")?,
        completed: row.get::<_, i64>("completed")? != 0,
        completed_at: row.get("completed_at")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        deleted_at: row.get("deleted_at")?,
    })
}

// leer_tarea: trae UNA tarea por id, o un error claro si no existe.
// Antes, cada comando repetía este query_row + el match de "no rows".
fn leer_tarea(conn: &Connection, id: &str) -> Result<Task, String> {
    conn.query_row(
        &format!("SELECT {COLUMNAS_TASK} FROM task WHERE id = ?1"),
        rusqlite::params![id],
        task_de_fila,
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => format!("No existe una tarea con id {}", id),
        _ => e.to_string(),
    })
}

// registrar_evento: escribe una fila en el log append-only (task_event).
// Todos los comandos lo usan: el log es la "memoria conductual" de la app
// (materia prima de la IA de la v2). `payload` es JSON opcional.
fn registrar_evento(
    conn: &Connection,
    task_id: &str,
    event_type: &str,
    payload: serde_json::Value,
    ahora: &str,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO task_event (id, task_id, event_type, payload, happened_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![
            uuid::Uuid::new_v4().to_string(),
            task_id,
            event_type,
            payload.to_string(),
            ahora
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------- LÓGICA (sin Tauri: recibe la conexión) ----------------

// listar_tareas: devuelve TODAS las tareas, sin filtros.
// Decisión registrada en la bitácora: el frontend filtra (no optimizar antes
// de tiempo). Migrar los filtros a Rust es barato si algún día escala.
fn listar_tareas(conn: &Connection) -> Result<Vec<Task>, String> {
    let mut stmt = conn
        .prepare(&format!(
            "SELECT {COLUMNAS_TASK} FROM task ORDER BY created_at"
        ))
        .map_err(|e| e.to_string())?;

    // Las filas se recogen en un Vec ANTES de devolver: el iterador de
    // query_map presta `stmt`, y `stmt` muere al salir de la función.
    let filas = stmt
        .query_map([], task_de_fila)
        .map_err(|e| e.to_string())?;
    let tareas = filas
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(tareas)
}

// crear_tarea: valida, genera los datos del sistema, inserta la fila y
// registra el evento 'created'.
// Contrato (bitácora, Sesión 2): create_task(input) -> Task
fn crear_tarea(conn: &Connection, input: CreateTaskInput) -> Result<Task, String> {
    // --- 1. VALIDACIONES (el borde: nada de basura entra a la BD) ---

    // trim() quita espacios de los extremos: "  hola  " -> "hola".
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
    let priority = input
        .priority
        .clone()
        .unwrap_or_else(|| "medium".to_string());
    if !PRIORIDADES_VALIDAS.contains(&priority.as_str()) {
        return Err(format!("Prioridad inválida: {}", priority));
    }

    // "Cinturón de seguridad" acordado: la UI usa selector de fecha (el usuario
    // nunca escribe una), pero si por bug llega un string malo, se rechaza.
    if let Some(due_date) = &input.due_date {
        chrono::NaiveDate::parse_from_str(due_date, "%Y-%m-%d")
            .map_err(|_| format!("Fecha inválida: {}", due_date))?;
    }

    // --- 2. DATOS QUE LA UI NO DECIDE (los genera Rust, siempre) ---

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    // --- 3. ESCRITURA EN LA BD ---

    // `?5` dos veces reutiliza `now` para created_at y updated_at
    // (al crear, ambos valen lo mismo).
    conn.execute(
        "INSERT INTO task (id, title, due_date, priority, completed, completed_at, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, 0, NULL, ?5, ?5)",
        rusqlite::params![id, title, input.due_date, priority, now],
    )
    .map_err(|e| e.to_string())?;

    // El payload del evento es el input tal cual llegó.
    registrar_evento(
        conn,
        &id,
        "created",
        serde_json::to_value(&input).map_err(|e| e.to_string())?,
        &now,
    )?;

    // --- 4. RESPUESTA: la Task completa, tal como quedó guardada ---
    Ok(Task {
        id,
        title: title.to_string(),
        due_date: input.due_date,
        priority,
        completed: false,
        completed_at: None,
        created_at: now.clone(),
        updated_at: now,
        deleted_at: None,
    })
}

// completar_tarea: marca/desmarca como completada (toggle).
// Contrato (paso 4): set_task_completed(id, completed) -> Task
// IDEMPOTENTE: si ya está en el estado pedido, no hay UPDATE ni evento.
// Registra 'completed' (tachar) o 'reopened' (desmarcar): para la IA de la
// v2 son señales conductuales distintas.
fn completar_tarea(conn: &Connection, id: &str, completed: bool) -> Result<Task, String> {
    let actual = leer_tarea(conn, id)?;

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

    let event_type = if completed { "completed" } else { "reopened" };
    registrar_evento(
        conn,
        id,
        event_type,
        serde_json::json!({ "completed": completed }),
        &now,
    )?;

    Ok(Task {
        completed,
        completed_at,
        updated_at: now,
        ..actual
    })
}

// mover_tarea: cambia la fecha límite.
// Contrato (paso 5): set_task_due_date(id, due_date) -> Task
// Registra 'rescheduled' con { de, a }: cuánto y cómo se pospone una tarea
// es una señal conductual clave para la IA de la v2.
fn mover_tarea(conn: &Connection, id: &str, due_date: &str) -> Result<Task, String> {
    chrono::NaiveDate::parse_from_str(due_date, "%Y-%m-%d")
        .map_err(|_| format!("Fecha inválida: {}", due_date))?;

    let actual = leer_tarea(conn, id)?;

    // Idempotencia: moverla al día donde ya está no genera UPDATE ni evento.
    if actual.due_date.as_deref() == Some(due_date) {
        return Ok(actual);
    }

    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE task SET due_date = ?1, updated_at = ?2 WHERE id = ?3",
        rusqlite::params![due_date, now, id],
    )
    .map_err(|e| e.to_string())?;

    // { de, a }: la fecha anterior sale de `actual` (clone porque la
    // reutilizamos después para la Task final).
    registrar_evento(
        conn,
        id,
        "rescheduled",
        serde_json::json!({ "de": actual.due_date.clone(), "a": due_date }),
        &now,
    )?;

    Ok(Task {
        due_date: Some(due_date.to_string()),
        updated_at: now,
        ..actual
    })
}

// actualizar_tarea: corrige título y/o prioridad.
// Contrato (paso 6): update_task(id, input) con cada campo opcional.
// Idempotente: si nada cambia realmente, no hay UPDATE ni eventos.
// Un evento 'updated' POR CAMPO con { campo, de, a } (granularidad para la IA).
fn actualizar_tarea(
    conn: &Connection,
    id: &str,
    input: UpdateTaskInput,
) -> Result<Task, String> {
    // --- Validaciones (mismas reglas del borde que en crear_tarea) ---
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

    let actual = leer_tarea(conn, id)?;

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

    if cambia_titulo {
        registrar_evento(
            conn,
            id,
            "updated",
            serde_json::json!({ "campo": "title", "de": actual.title, "a": titulo_final }),
            &now,
        )?;
    }
    if cambia_prioridad {
        registrar_evento(
            conn,
            id,
            "updated",
            serde_json::json!({ "campo": "priority", "de": actual.priority, "a": prioridad_final }),
            &now,
        )?;
    }

    Ok(Task {
        title: titulo_final,
        priority: prioridad_final,
        updated_at: now,
        ..actual
    })
}

// marcar_borrada: manda a la papelera (true) o restaura (false).
// Contrato (paso 7): toggle 'trashed' / 'restored', idempotente.
fn marcar_borrada(conn: &Connection, id: &str, deleted: bool) -> Result<Task, String> {
    let actual = leer_tarea(conn, id)?;

    if (actual.deleted_at.is_some()) == deleted {
        return Ok(actual);
    }

    let now = chrono::Utc::now().to_rfc3339();
    // deleted_at guarda CUÁNDO entró a la papelera; restaurar lo limpia.
    // El "cuándo se borró" histórico queda en task_event... hasta que la
    // tarea se purga: entonces todo su log muere con ella (privacidad).
    let deleted_at = if deleted { Some(now.clone()) } else { None };

    conn.execute(
        "UPDATE task SET deleted_at = ?1, updated_at = ?2 WHERE id = ?3",
        rusqlite::params![deleted_at, now, id],
    )
    .map_err(|e| e.to_string())?;

    let event_type = if deleted { "trashed" } else { "restored" };
    registrar_evento(
        conn,
        id,
        event_type,
        serde_json::json!({ "deleted": deleted }),
        &now,
    )?;

    Ok(Task {
        deleted_at,
        updated_at: now,
        ..actual
    })
}

// purgar_tarea: borrado PERMANENTE — la fila Y todo su log desaparecen.
fn purgar_tarea(conn: &Connection, id: &str) -> Result<(), String> {
    // Primero el log (los eventos), después la fila. El orden importa si
    // algún día se activan las foreign keys de SQLite: los eventos
    // referencian a task(id) y el padre no puede morir primero.
    conn.execute("DELETE FROM task_event WHERE task_id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;

    let eliminadas = conn
        .execute("DELETE FROM task WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;

    if eliminadas == 0 {
        return Err(format!("No existe una tarea con id {}", id));
    }

    Ok(())
}

// vaciar_papelera: borra TODAS las tareas en papelera (y sus eventos).
// Devuelve cuántas purgó (por si la UI quiere confirmarlo).
fn vaciar_papelera(conn: &Connection) -> Result<u64, String> {
    // El sub-SELECT dentro del DELETE borra los eventos de TODAS las
    // tareas que están en la papelera, en una sola pasada por la tabla.
    conn.execute(
        "DELETE FROM task_event
         WHERE task_id IN (SELECT id FROM task WHERE deleted_at IS NOT NULL)",
        [],
    )
    .map_err(|e| e.to_string())?;

    let purgadas = conn
        .execute("DELETE FROM task WHERE deleted_at IS NOT NULL", [])
        .map_err(|e| e.to_string())?;

    Ok(purgadas as u64)
}

// ---------------- COMANDOS TAURI (envoltorios finos) ----------------

// El estado global es un Mutex<Connection>: una sola conexión a SQLite
// compartida por todos los comandos. El lock evita que dos comandos la usen
// a la vez (SQLite no maneja concurrencia de escritura bien).
// El `?` sobre el lock propaga "el mutex quedó envenenado" como String.

#[tauri::command]
pub fn get_tasks(state: State<AppState>) -> Result<Vec<Task>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    listar_tareas(&conn)
}

#[tauri::command]
pub fn create_task(state: State<AppState>, input: CreateTaskInput) -> Result<Task, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    crear_tarea(&conn, input)
}

#[tauri::command]
pub fn set_task_completed(
    state: State<AppState>,
    id: String,
    completed: bool,
) -> Result<Task, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    completar_tarea(&conn, &id, completed)
}

#[tauri::command]
pub fn set_task_due_date(
    state: State<AppState>,
    id: String,
    due_date: String,
) -> Result<Task, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    mover_tarea(&conn, &id, &due_date)
}

#[tauri::command]
pub fn update_task(
    state: State<AppState>,
    id: String,
    input: UpdateTaskInput,
) -> Result<Task, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    actualizar_tarea(&conn, &id, input)
}

#[tauri::command]
pub fn set_task_deleted(
    state: State<AppState>,
    id: String,
    deleted: bool,
) -> Result<Task, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    marcar_borrada(&conn, &id, deleted)
}

#[tauri::command]
pub fn purge_task(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    purgar_tarea(&conn, &id)
}

#[tauri::command]
pub fn purge_all_tasks(state: State<AppState>) -> Result<u64, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    vaciar_papelera(&conn)
}

// =====================================================================
// TESTS
// Los tests usan una BD SQLite EN MEMORIA con el MISMO esquema que la app
// (db::crear_esquema). Así se prueba el comportamiento real (validaciones,
// idempotencia y eventos) sin depender de Tauri ni de archivos en disco.
// =====================================================================
#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::crear_esquema;

    // Base de datos limpia y aislada por test (cada test tiene la suya).
    fn bd() -> Connection {
        let conn = Connection::open_in_memory().expect("BD en memoria");
        crear_esquema(&conn).expect("esquema");
        conn
    }

    // Entrada mínima: solo el título (los opcionales quedan en None).
    fn entrada(titulo: &str) -> CreateTaskInput {
        CreateTaskInput {
            title: titulo.to_string(),
            due_date: None,
            priority: None,
        }
    }

    // Atajo: crear una tarea válida y devolverla.
    fn crear(conn: &Connection, titulo: &str) -> Task {
        crear_tarea(conn, entrada(titulo)).expect("la tarea debería crearse")
    }

    // Cuántos eventos de un tipo tiene una tarea.
    fn eventos(conn: &Connection, task_id: &str, tipo: &str) -> i64 {
        conn.query_row(
            "SELECT COUNT(*) FROM task_event WHERE task_id = ?1 AND event_type = ?2",
            rusqlite::params![task_id, tipo],
            |r| r.get(0),
        )
        .expect("contar eventos")
    }

    fn total_eventos(conn: &Connection, task_id: &str) -> i64 {
        conn.query_row(
            "SELECT COUNT(*) FROM task_event WHERE task_id = ?1",
            rusqlite::params![task_id],
            |r| r.get(0),
        )
        .expect("contar eventos")
    }

    fn filas_tarea(conn: &Connection) -> i64 {
        conn.query_row("SELECT COUNT(*) FROM task", [], |r| r.get(0))
            .expect("contar tareas")
    }

    // ---------------- crear_tarea ----------------

    #[test]
    fn crear_guarda_la_tarea_y_su_evento_created() {
        let conn = bd();
        let tarea = crear(&conn, "  comprar pan  ");

        assert_eq!(tarea.title, "comprar pan", "el título llega sin espacios");
        assert_eq!(tarea.priority, "medium", "prioridad por defecto");
        assert!(!tarea.completed);
        assert!(tarea.completed_at.is_none());
        assert!(tarea.deleted_at.is_none());
        assert_eq!(filas_tarea(&conn), 1);
        assert_eq!(eventos(&conn, &tarea.id, "created"), 1);
    }

    #[test]
    fn crear_rechaza_titulo_vacio_y_no_escribe_nada() {
        let conn = bd();
        let resultado = crear_tarea(&conn, entrada("   "));

        assert!(resultado.is_err());
        assert_eq!(filas_tarea(&conn), 0, "nada entra a la BD");
    }

    #[test]
    fn crear_rechaza_titulo_de_mas_de_200_caracteres() {
        let conn = bd();
        let largo = "a".repeat(201);

        let resultado = crear_tarea(&conn, entrada(&largo));

        assert!(resultado.is_err());
        assert_eq!(filas_tarea(&conn), 0);
    }

    #[test]
    fn crear_rechaza_prioridad_invalida() {
        let conn = bd();
        let input = CreateTaskInput {
            title: "tarea".to_string(),
            due_date: None,
            priority: Some("urgentísima".to_string()),
        };

        assert!(crear_tarea(&conn, input).is_err());
        assert_eq!(filas_tarea(&conn), 0);
    }

    #[test]
    fn crear_rechaza_fecha_imposible() {
        let conn = bd();
        let input = CreateTaskInput {
            title: "tarea".to_string(),
            due_date: Some("2026-13-45".to_string()),
            priority: None,
        };

        assert!(crear_tarea(&conn, input).is_err());
        assert_eq!(filas_tarea(&conn), 0);
    }

    // ---------------- completar_tarea ----------------

    #[test]
    fn completar_marca_la_tarea_y_registra_el_evento() {
        let conn = bd();
        let tarea = crear(&conn, "regar plantas");

        let marcada = completar_tarea(&conn, &tarea.id, true).expect("completar");

        assert!(marcada.completed);
        assert!(marcada.completed_at.is_some(), "guarda CUÁNDO se completó");
        assert_eq!(eventos(&conn, &tarea.id, "completed"), 1);
    }

    #[test]
    fn completar_dos_veces_es_idempotente() {
        let conn = bd();
        let tarea = crear(&conn, "regar plantas");

        completar_tarea(&conn, &tarea.id, true).expect("primera");
        completar_tarea(&conn, &tarea.id, true).expect("segunda");

        assert_eq!(
            eventos(&conn, &tarea.id, "completed"),
            1,
            "el segundo click no duplica el evento"
        );
    }

    #[test]
    fn desmarcar_limpia_completed_at_y_registra_reopened() {
        let conn = bd();
        let tarea = crear(&conn, "regar plantas");
        completar_tarea(&conn, &tarea.id, true).expect("completar");

        let reabierta = completar_tarea(&conn, &tarea.id, false).expect("desmarcar");

        assert!(!reabierta.completed);
        assert!(reabierta.completed_at.is_none(), "vuelve a NULL");
        assert_eq!(eventos(&conn, &tarea.id, "reopened"), 1);
    }

    #[test]
    fn completar_una_tarea_inexistente_falla() {
        let conn = bd();
        let resultado = completar_tarea(&conn, "no-existe", true);

        assert!(resultado.is_err());
        assert!(resultado.unwrap_err().contains("no-existe"));
    }

    // ---------------- mover_tarea ----------------

    #[test]
    fn mover_registra_rescheduled_con_la_fecha_anterior_y_la_nueva() {
        let conn = bd();
        let tarea = crear(&conn, "pagar la luz");
        mover_tarea(&conn, &tarea.id, "2026-09-20").expect("primera fecha");

        let movida = mover_tarea(&conn, &tarea.id, "2026-09-25").expect("mover");

        assert_eq!(movida.due_date.as_deref(), Some("2026-09-25"));
        assert_eq!(eventos(&conn, &tarea.id, "rescheduled"), 2);
        let payload: String = conn
            .query_row(
                "SELECT payload FROM task_event WHERE task_id = ?1 AND event_type = 'rescheduled'
                 ORDER BY happened_at DESC LIMIT 1",
                rusqlite::params![tarea.id],
                |r| r.get(0),
            )
            .expect("payload");
        assert!(payload.contains("2026-09-20"), "guarda la fecha anterior (de)");
        assert!(payload.contains("2026-09-25"), "y la nueva (a)");
    }

    #[test]
    fn mover_a_la_misma_fecha_es_idempotente() {
        let conn = bd();
        let tarea = crear(&conn, "pagar la luz");
        mover_tarea(&conn, &tarea.id, "2026-09-20").expect("primera");

        mover_tarea(&conn, &tarea.id, "2026-09-20").expect("misma fecha");

        assert_eq!(eventos(&conn, &tarea.id, "rescheduled"), 1);
    }

    #[test]
    fn mover_rechaza_una_fecha_imposible() {
        let conn = bd();
        let tarea = crear(&conn, "pagar la luz");

        assert!(mover_tarea(&conn, &tarea.id, "2026-02-30").is_err());
    }

    // ---------------- actualizar_tarea ----------------

    #[test]
    fn actualizar_registra_un_evento_por_campo_cambiado() {
        let conn = bd();
        let tarea = crear(&conn, "tarea con typo");
        let input = UpdateTaskInput {
            title: Some("tarea sin typo".to_string()),
            priority: Some("high".to_string()),
        };

        let actualizada = actualizar_tarea(&conn, &tarea.id, input).expect("actualizar");

        assert_eq!(actualizada.title, "tarea sin typo");
        assert_eq!(actualizada.priority, "high");
        assert_eq!(eventos(&conn, &tarea.id, "updated"), 2, "un evento por campo");
    }

    #[test]
    fn actualizar_sin_cambios_reales_no_genera_eventos() {
        let conn = bd();
        let tarea = crear(&conn, "tarea");
        let input = UpdateTaskInput {
            title: Some("tarea".to_string()),
            priority: None,
        };

        actualizar_tarea(&conn, &tarea.id, input).expect("no-op");

        assert_eq!(total_eventos(&conn, &tarea.id), 1, "solo el 'created'");
    }

    #[test]
    fn actualizar_con_titulo_vacio_falla() {
        let conn = bd();
        let tarea = crear(&conn, "tarea");
        let input = UpdateTaskInput {
            title: Some("   ".to_string()),
            priority: None,
        };

        assert!(actualizar_tarea(&conn, &tarea.id, input).is_err());
    }

    // ---------------- papelera ----------------

    #[test]
    fn mandar_a_papelera_y_restaurar_registran_sus_eventos() {
        let conn = bd();
        let tarea = crear(&conn, "tarea descartable");

        let en_papelera = marcar_borrada(&conn, &tarea.id, true).expect("a papelera");
        assert!(en_papelera.deleted_at.is_some());
        assert_eq!(eventos(&conn, &tarea.id, "trashed"), 1);

        let restaurada = marcar_borrada(&conn, &tarea.id, false).expect("restaurar");
        assert!(restaurada.deleted_at.is_none());
        assert_eq!(eventos(&conn, &tarea.id, "restored"), 1);
    }

    #[test]
    fn mandar_a_papelera_dos_veces_es_idempotente() {
        let conn = bd();
        let tarea = crear(&conn, "tarea");

        marcar_borrada(&conn, &tarea.id, true).expect("primera");
        marcar_borrada(&conn, &tarea.id, true).expect("segunda");

        assert_eq!(eventos(&conn, &tarea.id, "trashed"), 1);
    }

    #[test]
    fn purgar_borra_la_tarea_y_todo_su_log() {
        let conn = bd();
        let tarea = crear(&conn, "tarea");
        completar_tarea(&conn, &tarea.id, true).expect("completar");
        marcar_borrada(&conn, &tarea.id, true).expect("a papelera");

        purgar_tarea(&conn, &tarea.id).expect("purgar");

        assert_eq!(filas_tarea(&conn), 0);
        assert_eq!(total_eventos(&conn, &tarea.id), 0, "sin rastro en el log");
    }

    #[test]
    fn purgar_una_tarea_inexistente_falla() {
        let conn = bd();
        assert!(purgar_tarea(&conn, "no-existe").is_err());
    }

    #[test]
    fn vaciar_papelera_borra_solo_las_borradas() {
        let conn = bd();
        let viva = crear(&conn, "queda");
        let borrada_a = crear(&conn, "se va 1");
        let borrada_b = crear(&conn, "se va 2");
        marcar_borrada(&conn, &borrada_a.id, true).expect("a papelera");
        marcar_borrada(&conn, &borrada_b.id, true).expect("a papelera");

        let purgadas = vaciar_papelera(&conn).expect("vaciar");

        assert_eq!(purgadas, 2);
        assert_eq!(filas_tarea(&conn), 1, "la tarea viva sigue");
        let quedan: String = conn
            .query_row("SELECT id FROM task", [], |r| r.get(0))
            .expect("la que queda");
        assert_eq!(quedan, viva.id);
        assert_eq!(total_eventos(&conn, &borrada_a.id), 0);
    }

    // ---------------- listar ----------------

    #[test]
    fn listar_devuelve_todas_incluidas_las_de_papelera() {
        let conn = bd();
        let activa = crear(&conn, "activa");
        let borrada = crear(&conn, "en papelera");
        marcar_borrada(&conn, &borrada.id, true).expect("a papelera");

        let todas = listar_tareas(&conn).expect("listar");

        assert_eq!(todas.len(), 2, "el filtro por papelera es del frontend");
        assert!(todas.iter().any(|t| t.id == activa.id));
        assert!(todas.iter().any(|t| t.id == borrada.id));
    }
}
