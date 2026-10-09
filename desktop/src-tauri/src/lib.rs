//! Tally desktop shell: starts the bundled backend (the frozen FastAPI app), waits for it, and points
//! the window at it. The backend serves the UI and the phone capture page on the LAN, so the shell
//! needs no IPC. See .wayfinder/desktop-app/research/02-tauri-sidecar.md.

use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Read, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};

use tauri::{Manager, RunEvent, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

const PREFERRED_PORT: u16 = 8765;
const HEALTH_TIMEOUT: Duration = Duration::from_secs(90); // first launch can be slow (macOS scans the bundle)

struct Backend(Mutex<Option<Child>>);

fn backend_exe(app: &tauri::AppHandle) -> tauri::Result<PathBuf> {
    let name = if cfg!(windows) { "tally-api.exe" } else { "tally-api" };
    Ok(app.path().resource_dir()?.join("tally-api").join(name))
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
        let _ = Command::new("taskkill").args(["/PID", pid, "/IM", "tally-api.exe", "/F"]).status();
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

fn show_error(win: &WebviewWindow, message: &str) {
    let js = format!(
        "document.getElementById('status').textContent='Tally could not start';\
         document.getElementById('bar').style.display='none';\
         const e=document.getElementById('error');e.style.display='block';e.textContent={};",
        serde_json_string(message)
    );
    let _ = win.eval(&js);
}

fn serde_json_string(s: &str) -> String {
    format!("\"{}\"", s.replace('\\', "\\\\").replace('"', "\\\"").replace('\n', " "))
}

fn start_backend(app: &tauri::AppHandle, win: WebviewWindow) -> tauri::Result<()> {
    let data_dir = app.path().data_dir()?.join("Tally");
    let log_dir = app.path().app_log_dir()?;
    fs::create_dir_all(&data_dir)?;
    fs::create_dir_all(&log_dir)?;
    let pid_file = data_dir.join("tally-api.pid");
    stop_orphan(&pid_file);

    let log_path = log_dir.join("tally-api.log");
    let log = OpenOptions::new().create(true).append(true).open(&log_path)?;
    let exe = backend_exe(app)?;
    let mut child = match Command::new(&exe)
        .args(["--data-dir", &data_dir.to_string_lossy(), "--port", &PREFERRED_PORT.to_string()])
        .stdin(Stdio::piped()) // the backend exits when this pipe closes, even if the shell crashes
        .stdout(Stdio::piped())
        .stderr(Stdio::from(log.try_clone()?))
        .spawn()
    {
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
            show_error(&win, "The backend stopped while starting. Its log is in ~/Library/Logs/ph.matchmo.tally.");
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
    if let Ok(dir) = app.path().data_dir() {
        let _ = fs::remove_file(dir.join("Tally").join("tally-api.pid"));
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
            let win = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("Tally")
                .inner_size(1280.0, 840.0)
                .min_inner_size(900.0, 600.0)
                .build()?;
            start_backend(app.handle(), win)?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Tally");

    app.run(|app, event| {
        if let RunEvent::Exit = event {
            stop_backend(app);
        }
    });
}

