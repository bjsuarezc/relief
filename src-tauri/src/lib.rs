// lib.rs: el punto de entrada de la app Tauri.
// Solo hace "cableado" (wiring): arma el estado global y registra los comandos.
// La lógica real vive en db.rs y tasks.rs.

mod bandeja;
mod db;
mod tasks;

use std::sync::Mutex;

use db::init_db;
use rusqlite::Connection;
use tauri::Manager;

// El estado global que todos los comandos comparten.
// - pub: para que tasks.rs pueda usarlo vía crate::AppState.
// - Mutex: garantiza que solo un comando acceda a la conexión a la vez.
// - .0: el Connection es "público dentro de la tupla" para poder hacer
//   state.0.lock() desde los comandos.
pub struct AppState(pub Mutex<Connection>);

// run() arranca todo Tauri:
// - setup: corre UNA vez antes de mostrar la ventana. Aquí abrimos la BD y
//   la registramos como estado global (app.manage). Después, cualquier
//   comando la recibe como State<AppState> sin volver a abrirla.
// - invoke_handler: la lista de comandos que el frontend puede invocar.
//   Ojo: si agregas un comando y no lo registras aquí, Tauri responderá
//   "comando no encontrado" aunque la función exista.
// - cfg_attr(mobile): cuando compilemos para móvil (v2+), Tauri necesita
//   otro punto de entrada; este atributo lo activa solo en esa plataforma.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_positioner::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _atajo, evento| bandeja::al_atajo(app, evento.state()))
                .build(),
        )
        .on_window_event(bandeja::al_evento_ventana)
        .setup(|app| {
            let conn = init_db(app.handle()).expect("no se pudo inicializar la base de datos");
            app.manage(AppState(Mutex::new(conn)));
            bandeja::configurar(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            tasks::get_tasks,
            tasks::create_task,
            tasks::set_task_completed,
            tasks::set_task_due_date,
            tasks::update_task,
            tasks::set_task_deleted,
            tasks::purge_task,
            tasks::purge_all_tasks
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
