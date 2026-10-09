# First-run wizard and app lifecycle

Type: grilling (HITL)
Status: open
Assignee:
Blocked by: 02, 03, 08

## Question

Screen by screen, what does the first-run wizard show and do (Ollama check, install, model pull with progress, Company details, test scan, the firewall prompt), and what happens on every failure path (no internet during setup, not enough disk, the user cancels, Ollama won't start)? After setup: what happens when the window closes, which port the app uses, and what the Reviewer sees when Ollama is not running.

Also settle, from the research: the app-data folder name (Tauri defaults to the bundle id, not `Tally`), adding the Windows firewall allow rule in the installer, and what the app does when another Ollama model is loaded.
