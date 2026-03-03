// SPDX-License-Identifier: MIT
// Copyright (c) 2026 refinex-lab

/**
 * Root application component for Refinex Terminal.
 *
 * Phase 1: single-pane layout with a live PTY session.
 * Phase 1.3 will add the TabBar and multi-pane support.
 */

import "./App.css";
import { TerminalPane } from "./components/TerminalPane";

function App() {
  return (
    <div className="app">
      <TerminalPane />
    </div>
  );
}

export default App;
