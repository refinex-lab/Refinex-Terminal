!include "MUI2.nsh"
!include "FileFunc.nsh"

; Custom installer hooks for Refinex Terminal
; This script adds context menu integration and PATH configuration

; Called after installation
Function .onInstSuccess
  ; Add context menu entries
  ${If} ${RunningX64}
    SetRegView 64
  ${EndIf}

  ; Get installation directory
  StrCpy $0 "$INSTDIR\refinex-terminal.exe"

  ; Add folder context menu
  WriteRegStr HKCR "Directory\shell\RefinexTerminal" "" "Open Refinex Terminal here"
  WriteRegStr HKCR "Directory\shell\RefinexTerminal" "Icon" "$0"
  WriteRegStr HKCR "Directory\shell\RefinexTerminal\command" "" '"$0" "%V"'

  ; Add folder background context menu
  WriteRegStr HKCR "Directory\Background\shell\RefinexTerminal" "" "Open Refinex Terminal here"
  WriteRegStr HKCR "Directory\Background\shell\RefinexTerminal" "Icon" "$0"
  WriteRegStr HKCR "Directory\Background\shell\RefinexTerminal\command" "" '"$0" "%V"'

  ; Add drive context menu
  WriteRegStr HKCR "Drive\shell\RefinexTerminal" "" "Open Refinex Terminal here"
  WriteRegStr HKCR "Drive\shell\RefinexTerminal" "Icon" "$0"
  WriteRegStr HKCR "Drive\shell\RefinexTerminal\command" "" '"$0" "%V"'

  ; Add to PATH (per-user installation)
  ${If} $InstallMode == "CurrentUser"
    ; Read current user PATH
    ReadRegStr $1 HKCU "Environment" "Path"

    ; Check if already in PATH
    ${StrContains} $2 "$INSTDIR" "$1"
    ${If} $2 == ""
      ; Not in PATH, add it
      ${If} $1 == ""
        WriteRegStr HKCU "Environment" "Path" "$INSTDIR"
      ${Else}
        WriteRegStr HKCU "Environment" "Path" "$1;$INSTDIR"
      ${EndIf}

      ; Notify system of environment change
      SendMessage ${HWND_BROADCAST} ${WM_WININICHANGE} 0 "STR:Environment" /TIMEOUT=5000
    ${EndIf}
  ${EndIf}

  ; Add to PATH (system-wide installation)
  ${If} $InstallMode == "AllUsers"
    ; Read current system PATH
    ReadRegStr $1 HKLM "SYSTEM\CurrentControlSet\Control\Session Manager\Environment" "Path"

    ; Check if already in PATH
    ${StrContains} $2 "$INSTDIR" "$1"
    ${If} $2 == ""
      ; Not in PATH, add it
      ${If} $1 == ""
        WriteRegStr HKLM "SYSTEM\CurrentControlSet\Control\Session Manager\Environment" "Path" "$INSTDIR"
      ${Else}
        WriteRegStr HKLM "SYSTEM\CurrentControlSet\Control\Session Manager\Environment" "Path" "$1;$INSTDIR"
      ${EndIf}

      ; Notify system of environment change
      SendMessage ${HWND_BROADCAST} ${WM_WININICHANGE} 0 "STR:Environment" /TIMEOUT=5000
    ${EndIf}
  ${EndIf}
FunctionEnd

; Called before uninstallation
Function un.onInit
  ; Remove context menu entries
  ${If} ${RunningX64}
    SetRegView 64
  ${EndIf}

  DeleteRegKey HKCR "Directory\shell\RefinexTerminal"
  DeleteRegKey HKCR "Directory\Background\shell\RefinexTerminal"
  DeleteRegKey HKCR "Drive\shell\RefinexTerminal"

  ; Remove from PATH (per-user)
  ReadRegStr $0 HKCU "Environment" "Path"
  ${If} $0 != ""
    ${StrRep} $1 $0 ";$INSTDIR" ""
    ${StrRep} $2 $1 "$INSTDIR;" ""
    ${StrRep} $3 $2 "$INSTDIR" ""
    WriteRegStr HKCU "Environment" "Path" "$3"
    SendMessage ${HWND_BROADCAST} ${WM_WININICHANGE} 0 "STR:Environment" /TIMEOUT=5000
  ${EndIf}

  ; Remove from PATH (system-wide)
  ReadRegStr $0 HKLM "SYSTEM\CurrentControlSet\Control\Session Manager\Environment" "Path"
  ${If} $0 != ""
    ${StrRep} $1 $0 ";$INSTDIR" ""
    ${StrRep} $2 $1 "$INSTDIR;" ""
    ${StrRep} $3 $2 "$INSTDIR" ""
    WriteRegStr HKLM "SYSTEM\CurrentControlSet\Control\Session Manager\Environment" "Path" "$3"
    SendMessage ${HWND_BROADCAST} ${WM_WININICHANGE} 0 "STR:Environment" /TIMEOUT=5000
  ${EndIf}
FunctionEnd
