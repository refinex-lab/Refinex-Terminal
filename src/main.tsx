import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import "@/styles/globals.css";
import "@/styles/animations.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
