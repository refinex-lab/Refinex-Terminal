import { TerminalView } from "@/components/terminal/TerminalView";
import "./App.css";

function App() {
  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column" }}>
      <TerminalView />
    </div>
  );
}

export default App;
