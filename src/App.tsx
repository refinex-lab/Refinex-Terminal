// SPDX-License-Identifier: MIT
// Copyright (c) 2026 refinex-lab

import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import "./App.css";

// Tokyo Night theme colors
const TOKYO_NIGHT = {
  background: "#1a1b26",
  foreground: "#c0caf5",
  cursor: "#c0caf5",
  cursorAccent: "#1a1b26",
  selectionBackground: "#283457",
  black: "#15161e",
  red: "#f7768e",
  green: "#9ece6a",
  yellow: "#e0af68",
  blue: "#7aa2f7",
  magenta: "#bb9af7",
  cyan: "#7dcfff",
  white: "#a9b1d6",
  brightBlack: "#414868",
  brightRed: "#f7768e",
  brightGreen: "#9ece6a",
  brightYellow: "#e0af68",
  brightBlue: "#7aa2f7",
  brightMagenta: "#bb9af7",
  brightCyan: "#7dcfff",
  brightWhite: "#c0caf5",
};

function App() {
  const termRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!termRef.current || terminalRef.current) return;

    const terminal = new Terminal({
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
      fontSize: 14,
      lineHeight: 1.2,
      theme: TOKYO_NIGHT,
      cursorBlink: true,
      cursorStyle: "block",
      allowTransparency: true,
      scrollback: 10000,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    terminal.open(termRef.current);
    fitAddon.fit();

    // Welcome banner
    terminal.writeln(
      "\x1b[1;35m  ____       __ _                  _____\x1b[0m"
    );
    terminal.writeln(
      "\x1b[1;35m |  _ \\ ___ / _(_)_ __   _____  __|_   _|__ _ __ _ __ ___\x1b[0m"
    );
    terminal.writeln(
      "\x1b[1;35m | |_) / _ \\ |_| | '_ \\ / _ \\ \\/ /  | |/ _ \\ '__| '_ ` _ \\\x1b[0m"
    );
    terminal.writeln(
      "\x1b[1;35m |  _ <  __/  _| | | | |  __/>  <   | |  __/ |  | | | | | |\x1b[0m"
    );
    terminal.writeln(
      "\x1b[1;35m |_| \\_\\___|_| |_|_| |_|\\___/_/\\_\\  |_|\\___|_|  |_| |_| |_|\x1b[0m"
    );
    terminal.writeln("");
    terminal.writeln(
      "\x1b[2m  ⚡ The AI-First Terminal — Built for the Agentic Age\x1b[0m"
    );
    terminal.writeln(
      "\x1b[2m  Claude Code · Codex CLI · Copilot CLI · Gemini CLI\x1b[0m"
    );
    terminal.writeln("");
    terminal.writeln(
      "\x1b[33m  Phase 0 scaffold running — PTY integration coming in Phase 1\x1b[0m"
    );
    terminal.writeln("");

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    const handleResize = () => fitAddon.fit();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  return (
    <div className="app">
      <div ref={termRef} className="terminal-container" />
    </div>
  );
}

export default App;
