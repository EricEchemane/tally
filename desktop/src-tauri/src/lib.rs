//! Tally desktop shell: starts the bundled backend (the frozen FastAPI app), waits for it, and points
//! the window at it. The backend serves the UI and the phone capture page on the LAN, so the shell
//! needs no IPC. See .wayfinder/desktop-app/research/02-tauri-sidecar.md.

use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Read, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU16, Ordering};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

use tauri::webview::DownloadEvent;
use tauri::{Manager, RunEvent, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

const PREFERRED_PORT: u16 = 8765;
/// The backend and taskkill are console programs; without this each opens a black console window.
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;
const HEALTH_TIMEOUT: Duration = Duration::from_secs(90); // first launch can be slow (macOS scans the bundle)

struct Backend(Mutex<Option<Child>>);

/// The backend's port once it is up (0 = not yet), and whether the Reviewer already chose to quit.
static PORT: AtomicU16 = AtomicU16::new(0);
static QUIT_CONFIRMED: AtomicBool = AtomicBool::new(false);
/// The page navigates here when the Reviewer picks "Quit anyway" in the quit dialog.
const QUIT_PATH: &str = "/__tally/quit";

fn backend_exe(app: &tauri::AppHandle) -> tauri::Result<PathBuf> {
    let name = if cfg!(windows) { "tally-api.exe" } else { "tally-api" };
    Ok(app.path().resource_dir()?.join("tally-api").join(name))
}

/// ~/Library/Application Support/Tally on macOS. On Windows, %LOCALAPPDATA%\ph.matchmo.tally: Local, not
/// Roaming, so roaming profiles never copy an open database or the photos. Not %LOCALAPPDATA%\Tally, which
/// is where the per-user installer puts the app itself; the uninstaller's "Delete the application data"
/// box clears this folder, and windows/installer-hooks.nsh always removes Tally's Ollama from it.
fn tally_data_dir(app: &tauri::AppHandle) -> tauri::Result<PathBuf> {
    #[cfg(windows)]
    return app.path().app_local_data_dir();
    #[cfg(not(windows))]
    return Ok(app.path().data_dir()?.join("Tally"));
}

/// A previous run that crashed can leave its backend holding the port and the database.
fn stop_orphan(pid_file: &Path) {
    let Ok(pid) = fs::read_to_string(pid_file) else { return };
    let pid = pid.trim();
    #[cfg(unix)]
    {
        let name = Command::new("ps").args(["-p", pid, "-o", "comm="]).output();
        if matches!(name, Ok(out) if String::from_utf8_lossy(&out.stdout).contains("tally-api")) {
            let _ = Command::new("kill").arg(pid).status();
            thread::sleep(Duration::from_millis(500));
        }
    }
    #[cfg(windows)]
    {
        // Only if that PID is still our backend: Windows reuses PIDs.
        let _ = Command::new("taskkill")
            .args(["/F", "/FI", &format!("PID eq {pid}"), "/FI", "IMAGENAME eq tally-api.exe"])
            .creation_flags(CREATE_NO_WINDOW)
            .status();
        thread::sleep(Duration::from_millis(500));
    }
    let _ = fs::remove_file(pid_file);
}

fn healthy(port: u16) -> bool {
    let Ok(mut s) = TcpStream::connect_timeout(&([127, 0, 0, 1], port).into(), Duration::from_secs(2)) else {
        return false;
    };
    let _ = s.set_read_timeout(Some(Duration::from_secs(5)));
    if s.write_all(b"GET /api/health HTTP/1.0\r\nHost: 127.0.0.1\r\n\r\n").is_err() {
        return false;
    }
    let mut head = [0u8; 12];
    s.read_exact(&mut head).is_ok() && head.ends_with(b"200")
}

/// Receipts and questions still waiting for the AI, from GET /api/setup/pending ({"length": N}).
fn pending_work() -> u32 {
    let port = PORT.load(Ordering::SeqCst);
    if port == 0 {
        return 0;
    }
    let Ok(mut s) = TcpStream::connect_timeout(&([127, 0, 0, 1], port).into(), Duration::from_millis(800)) else {
        return 0;
    };
    let _ = s.set_read_timeout(Some(Duration::from_millis(3000)));
    if s.write_all(b"GET /api/setup/pending HTTP/1.0\r\nHost: 127.0.0.1\r\n\r\n").is_err() {
        return 0;
    }
    let mut body = String::new();
    let _ = s.read_to_string(&mut body);
    body.split("\"length\":")
        .nth(1)
        .and_then(|rest| rest.trim_start().split(|c: char| !c.is_ascii_digit()).next())
        .and_then(|n| n.parse().ok())
        .unwrap_or(0)
}

/// Quitting with work still queued loses nothing (it resumes at the next launch), but say so first.
/// Returns true when the quit should be held back while the page asks.
fn hold_quit(app: &tauri::AppHandle) -> bool {
    if QUIT_CONFIRMED.load(Ordering::SeqCst) {
        return false;
    }
    let n = pending_work();
    if n == 0 {
        return false;
    }
    match app.get_webview_window("main") {
        Some(w) => {
            let _ = w.set_focus();
            let _ = w.eval(&format!("window.dispatchEvent(new CustomEvent('tally:confirm-quit', {{ detail: {{ pending: {n} }} }}));"));
            true
        }
        None => false,
    }
}

fn show_error(win: &WebviewWindow, message: &str) {
    let js = format!(
        "document.getElementById('status').textContent='Tally could not start';\
         document.getElementById('bar').style.display='none';\
         const e=document.getElementById('error');e.style.display='block';e.textContent={};",
        serde_json_string(message)
    );
    let _ = win.eval(&js);
}

/// Downloads (CSV, Excel, backups) go straight to the OS Downloads folder under a name that doesn't
/// overwrite an existing file. When one finishes, the page gets a `tally:download` event.
fn unique_in(dir: &Path, name: &str) -> PathBuf {
    let candidate = dir.join(name);
    if !candidate.exists() {
        return candidate;
    }
    let p = Path::new(name);
    let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("download");
    let ext = p.extension().and_then(|s| s.to_str()).map(|e| format!(".{e}")).unwrap_or_default();
    (1..).map(|n| dir.join(format!("{stem} ({n}){ext}"))).find(|c| !c.exists()).expect("a free name")
}

fn on_download(webview: tauri::Webview, event: DownloadEvent<'_>) -> bool {
    match event {
        DownloadEvent::Requested { url, destination } => {
            let name = destination
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .filter(|n| !n.is_empty())
                .or_else(|| url.path_segments().and_then(|mut s| s.next_back()).map(str::to_owned))
                .unwrap_or_else(|| "download".into());
            if let Ok(dir) = webview.app_handle().path().download_dir() {
                *destination = unique_in(&dir, &name);
            }
        }
        DownloadEvent::Finished { path, success, .. } => {
            let path = path.map(|p| p.to_string_lossy().into_owned()).unwrap_or_default();
            let js = format!(
                "window.dispatchEvent(new CustomEvent('tally:download', {{ detail: {{ path: {}, success: {} }} }}));",
                serde_json_string(&path),
                success
            );
            let _ = webview.eval(&js);
        }
        _ => {}
    }
    true
}

fn serde_json_string(s: &str) -> String {
    format!("\"{}\"", s.replace('\\', "\\\\").replace('"', "\\\"").replace('\n', " "))
}

fn start_backend(app: &tauri::AppHandle, win: WebviewWindow) -> tauri::Result<()> {
    let data_dir = tally_data_dir(app)?;
    #[cfg(windows)]
    let log_dir = data_dir.join("logs");
    #[cfg(not(windows))]
    let log_dir = app.path().app_log_dir()?;
    fs::create_dir_all(&data_dir)?;
    fs::create_dir_all(&log_dir)?;
    let pid_file = data_dir.join("tally-api.pid");
    stop_orphan(&pid_file);

    let log_path = log_dir.join("tally-api.log");
    let log = OpenOptions::new().create(true).append(true).open(&log_path)?;
    let exe = backend_exe(app)?;
    let mut command = Command::new(&exe);
    command
        .args(["--data-dir", &data_dir.to_string_lossy(), "--log-dir", &log_dir.to_string_lossy(), "--port", &PREFERRED_PORT.to_string()])
        .stdin(Stdio::piped()) // the backend exits when this pipe closes, even if the shell crashes
        .stdout(Stdio::piped())
        .stderr(Stdio::from(log.try_clone()?));
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    let mut child = match command.spawn() {
        Ok(child) => child,
        Err(e) => {
            show_error(&win, &format!("The backend at {} did not start: {e}", exe.display()));
            return Ok(());
        }
    };
    let _ = fs::write(&pid_file, child.id().to_string());
    let stdout = child.stdout.take().expect("piped stdout");
    app.manage(Backend(Mutex::new(Some(child))));

    thread::spawn(move || {
        let mut log = log;
        let mut ready = false;
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            let _ = writeln!(log, "{line}");
            if ready {
                continue;
            }
            let Some(port) = line.strip_prefix("TALLY_READY port=").and_then(|r| r.split_whitespace().next()) else {
                continue;
            };
            let Ok(port) = port.parse::<u16>() else { continue };
            ready = true;
            PORT.store(port, Ordering::SeqCst);
            let started = Instant::now();
            let win = win.clone();
            thread::spawn(move || {
                while !healthy(port) {
                    if started.elapsed() > HEALTH_TIMEOUT {
                        show_error(&win, "The backend did not answer. Quit Tally and open it again.");
                        return;
                    }
                    thread::sleep(Duration::from_millis(250));
                }
                let url: Url = format!("http://127.0.0.1:{port}/").parse().expect("valid url");
                let _ = win.navigate(url);
            });
        }
        if !ready {
            show_error(&win, "The backend stopped while starting. Restart Tally, then export diagnostics from Settings if it continues.");
        }
    });
    Ok(())
}

fn stop_backend(app: &tauri::AppHandle) {
    let Some(state) = app.try_state::<Backend>() else { return };
    let Some(mut child) = state.0.lock().unwrap().take() else { return };
    drop(child.stdin.take()); // EOF: the backend shuts down gracefully
    let deadline = Instant::now() + Duration::from_secs(4);
    while Instant::now() < deadline {
        if matches!(child.try_wait(), Ok(Some(_))) {
            break;
        }
        thread::sleep(Duration::from_millis(100));
    }
    let _ = child.kill();
    let _ = child.wait();
    if let Ok(dir) = tally_data_dir(app) {
        let _ = fs::remove_file(dir.join("tally-api.pid"));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }))
        .setup(|app| {
            let quit_handle = app.handle().clone();
            let win = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("Tally")
                .inner_size(1280.0, 840.0)
                .min_inner_size(900.0, 600.0)
                // Lets the page know it runs inside the app (downloads report back; see on_download).
                .initialization_script("window.__TALLY_DESKTOP__ = true;")
                .on_download(on_download)
                .on_navigation(move |url| {
                    if url.path() == QUIT_PATH {
                        QUIT_CONFIRMED.store(true, Ordering::SeqCst);
                        quit_handle.exit(0);
                        return false;
                    }
                    true
                })
                .build()?;
            let close_handle = app.handle().clone();
            win.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    if hold_quit(&close_handle) {
                        api.prevent_close();
                    }
                }
            });
            start_backend(app.handle(), win)?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Tally");

    app.run(|app, event| match event {
        // ⌘Q / Quit from the menu: same check as closing the window.
        RunEvent::ExitRequested { api, .. } => {
            if hold_quit(app) {
                api.prevent_exit();
            }
        }
        RunEvent::Exit => stop_backend(app),
        _ => {}
    });
}

