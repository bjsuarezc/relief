// bandeja.rs: Relief como utilidad de bandeja del sistema.
//
// La app no vive en una ventana clásica: es un panel sin marco que se abre
// desde el ícono de la bandeja (junto a la flecha de "íconos ocultos") o con
// un atajo global, y se oculta solo al perder el foco.
//
// - El ícono: clic izquierdo alterna el panel, clic derecho da Abrir/Salir.
// - La X no cierra la app, la oculta (por eso "Salir" vive en el menú).
// - El atajo global abre el panel desde cualquier app con la captura lista.

use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{App, AppHandle, Emitter, Manager, WebviewWindow, Window, WindowEvent};
use tauri_plugin_autostart::ManagerExt as _;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use tauri_plugin_positioner::{Position, WindowExt};

// Ctrl+Shift+Espacio. Ctrl+Alt+Espacio se probó primero y otra app de la
// máquina del propietario ya lo tenía reservado (Windows devolvió
// ERROR_HOTKEY_ALREADY_REGISTERED). Ojo con Ctrl+Alt+<letra>: en teclados en
// español Ctrl+Alt es AltGr y pisaría caracteres como @ o \.
const ATAJO_GLOBAL: &str = "ctrl+shift+space";

// Evento que el frontend escucha para poner el cursor en la captura.
const EVENTO_FOCO_CAPTURA: &str = "foco-captura";

// Al hacer clic en el ícono con el panel abierto, Windows le quita el foco
// (y lo ocultamos) ANTES de que llegue el clic. Sin esta ventana de gracia el
// clic lo volvería a abrir al instante y el panel nunca se podría cerrar
// desde el ícono.
const GRACIA_TRAS_BLUR: Duration = Duration::from_millis(250);

// Cuándo se ocultó el panel por perder el foco.
pub struct UltimoBlur(Mutex<Option<Instant>>);

impl UltimoBlur {
    pub fn new() -> Self {
        Self(Mutex::new(None))
    }
}

fn ventana_principal(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window("main")
}

// Coloca el panel: anclado sobre el ícono si el clic vino de la bandeja
// (el plugin recuerda dónde está el ícono aunque la barra esté arriba o a
// un lado); si no, en la esquina inferior derecha, donde suele estar.
fn colocar(ventana: &WebviewWindow, desde_bandeja: bool) {
    let posicion = if desde_bandeja {
        Position::TrayCenter
    } else {
        Position::BottomRight
    };
    if ventana.move_window(posicion).is_err() {
        let _ = ventana.move_window(Position::BottomRight);
    }
    mantener_en_pantalla(ventana);
}

// Un ícono pegado al borde derecho sacaría el panel de la pantalla al
// centrarlo sobre él: lo empujamos hacia adentro del monitor.
fn mantener_en_pantalla(ventana: &WebviewWindow) {
    let (Ok(pos), Ok(tam), Ok(Some(monitor))) = (
        ventana.outer_position(),
        ventana.outer_size(),
        ventana.current_monitor(),
    ) else {
        return;
    };
    let origen = monitor.position();
    let ancho_monitor = monitor.size().width as i32;
    let max_x = origen.x + ancho_monitor - tam.width as i32;
    let x = pos.x.clamp(origen.x, max_x.max(origen.x));
    if x != pos.x {
        let _ = ventana.set_position(tauri::PhysicalPosition::new(x, pos.y));
    }
}

fn mostrar_panel(app: &AppHandle, desde_bandeja: bool) {
    let Some(ventana) = ventana_principal(app) else {
        return;
    };
    colocar(&ventana, desde_bandeja);
    let _ = ventana.show();
    let _ = ventana.set_focus();
    let _ = app.emit(EVENTO_FOCO_CAPTURA, ());
}

pub fn alternar_panel(app: &AppHandle, desde_bandeja: bool) {
    let Some(ventana) = ventana_principal(app) else {
        return;
    };
    if ventana.is_visible().unwrap_or(false) {
        let _ = ventana.hide();
        return;
    }
    if desde_bandeja {
        let cerrado_recien = app
            .state::<UltimoBlur>()
            .0
            .lock()
            .ok()
            .and_then(|t| *t)
            .is_some_and(|t| t.elapsed() < GRACIA_TRAS_BLUR);
        if cerrado_recien {
            return;
        }
    }
    mostrar_panel(app, desde_bandeja);
}

// Handler del atajo global (se registra como plugin en lib.rs).
pub fn al_atajo(app: &AppHandle, estado: ShortcutState) {
    if estado == ShortcutState::Pressed {
        alternar_panel(app, false);
    }
}

// Eventos de la ventana: cerrar = ocultar, perder el foco = ocultar.
pub fn al_evento_ventana(ventana: &Window, evento: &WindowEvent) {
    if ventana.label() != "main" {
        return;
    }
    match evento {
        WindowEvent::CloseRequested { api, .. } => {
            api.prevent_close();
            let _ = ventana.hide();
        }
        WindowEvent::Focused(false) => {
            if let Ok(mut ultimo) = ventana.app_handle().state::<UltimoBlur>().0.lock() {
                *ultimo = Some(Instant::now());
            }
            let _ = ventana.hide();
        }
        _ => {}
    }
}

// Ícono + menú + atajo + inicio con el sistema. Se llama desde setup.
pub fn configurar(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    app.manage(UltimoBlur::new());

    let abrir = MenuItem::with_id(app, "abrir", "Abrir Relief", true, None::<&str>)?;
    let salir = MenuItem::with_id(app, "salir", "Salir", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&abrir, &salir])?;

    let mut bandeja = TrayIconBuilder::with_id("relief")
        .tooltip("Relief")
        .menu(&menu)
        // El clic izquierdo alterna el panel; el menú es solo del derecho.
        .show_menu_on_left_click(false)
        .on_menu_event(|app, evento| match evento.id().as_ref() {
            "abrir" => mostrar_panel(app, false),
            "salir" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|bandeja, evento| {
            // El plugin necesita ver los eventos para saber dónde está el
            // ícono y poder anclar el panel encima.
            tauri_plugin_positioner::on_tray_event(bandeja.app_handle(), &evento);
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = evento
            {
                alternar_panel(bandeja.app_handle(), true);
            }
        });
    if let Some(icono) = app.default_window_icon() {
        bandeja = bandeja.icon(icono.clone());
    }
    bandeja.build(app)?;

    // Si otra app ya tiene el atajo, Relief sigue funcionando por la
    // bandeja: avisamos por consola en vez de tumbar el arranque.
    if let Err(e) = app.global_shortcut().register(ATAJO_GLOBAL) {
        eprintln!("no se pudo registrar el atajo {ATAJO_GLOBAL}: {e}");
    }

    Ok(())
}

// Inicio con Windows: ANTES se activaba solo, sin preguntar (Sesión 22).
// Se volvió opt-in (Sesión 23) porque un instalador sin firma de reputación
// que además se registra solo en la clave Run del registro, sin que la
// persona lo pida, es exactamente el patrón que Windows Defender marca como
// sospechoso ("Behavior:Win32/SuspiciousFileInRunKey") — se confirmó en una
// instalación real. Ahora es un interruptor en el panel de ajustes; estos
// dos comandos son el puente para leerlo y cambiarlo.
#[tauri::command]
pub fn obtener_inicio_con_sistema(app: AppHandle) -> bool {
    app.autolaunch().is_enabled().unwrap_or(false)
}

#[tauri::command]
pub fn set_inicio_con_sistema(app: AppHandle, activo: bool) -> Result<(), String> {
    let inicio = app.autolaunch();
    let resultado = if activo { inicio.enable() } else { inicio.disable() };
    resultado.map_err(|e| e.to_string())
}
