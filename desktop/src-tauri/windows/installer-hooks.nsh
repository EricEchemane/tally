; Tally's additions to Tauri's NSIS installer (DESKTOP.md, "Installation and setup").
; Per user, the app installs to $LOCALAPPDATA\Tally with resources next to Tally.exe, so the sidecar is
; $INSTDIR\tally-api\tally-api.exe. Tally's data is in $LOCALAPPDATA\${BUNDLEID}, which Tauri's own
; "Delete the application data" box clears; nothing here deletes the Reviewer's data.

; This one elevated action permits QR phone capture on Private and Public networks (Windows labels most
; home and office Wi-Fi Public, and a Private-only rule left the phone unable to connect). If it is declined,
; the capture screen says so and offers to ask again (api/desktop_setup.py, /api/setup/firewall).
!macro NSIS_HOOK_POSTINSTALL
  DetailPrint "Allowing Tally phone capture on the local network..."
  ; Replace, not add: reinstalling over an older version would otherwise leave duplicate rules.
  ExecShellWait "runas" "$SYSDIR\cmd.exe" '/c netsh advfirewall firewall delete rule name="Tally phone capture" & netsh advfirewall firewall add rule name="Tally phone capture" dir=in action=allow program="$INSTDIR\tally-api\tally-api.exe" enable=yes profile=private,public' SW_HIDE
!macroend

; Tally's own Ollama (unpacked into the data folder at setup) goes on uninstall, whatever the box says.
; Only that copy is stopped, never an Ollama the Reviewer installed. Updates reinstall over the top and keep it.
!macro NSIS_HOOK_PREUNINSTALL
  ${If} $UpdateMode <> 1
    nsExec::Exec `powershell.exe -NoProfile -Command "Get-Process ollama -ErrorAction SilentlyContinue | Where-Object { $$_.Path -like '$LOCALAPPDATA\${BUNDLEID}\ollama\*' } | Stop-Process -Force"`
  ${EndIf}
!macroend

; The downloaded model (~/.ollama) is never touched: another app may use it.
!macro NSIS_HOOK_POSTUNINSTALL
  ${If} $UpdateMode <> 1
    RMDir /r "$LOCALAPPDATA\${BUNDLEID}\ollama"
    ExecShellWait "runas" "$SYSDIR\netsh.exe" 'advfirewall firewall delete rule name="Tally phone capture"' SW_HIDE
  ${EndIf}
!macroend
