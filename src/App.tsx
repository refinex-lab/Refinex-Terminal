import { useEffect, useRef } from "react";
import { TabBar } from "@/components/tabs/TabBar";
import { TerminalView } from "@/components/terminal/TerminalView";
import { useTerminalStore } from "@/stores/terminal-store";
import "./App.css";

function App() {
  const { sessions, addSession } = useTerminalStore();
  const initializedRef = useRef(false);

  // Initialize with one terminal session
  useEffect(() => {
    if (!initializedRef.current && sessions.length === 0) {
      initializedRef.current = true;
      addSession({
        id: `terminal-${Date.now()}`,
        title: "Terminal 1",
        cwd: "~",
        ptyId: null,
      });
    }
  }, [sessions.length, addSession]);

  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column" }}>
      <TabBar />
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {sessions.map((session) => (
          <TerminalView key={session.id} sessionId={session.id} />
        ))}
      </div>
    </div>
  );
}

export default App;
