import { useFileEditorStore } from "@/stores/file-editor-store";
import { FileTabBar } from "./FileTabBar";
import { FilePreview } from "./FilePreview";

interface FileEditorPanelProps {
  className?: string;
}

export function FileEditorPanel({ className = "" }: FileEditorPanelProps) {
  const { tabs, activeTabId } = useFileEditorStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-col h-full ${className}`} style={{ backgroundColor: "var(--ui-background)" }}>
      <FileTabBar />
      {activeTab && (
        <div className="flex-1 overflow-hidden">
          <FilePreview
            key={activeTab.id}
            filePath={activeTab.path}
            fileName={activeTab.name}
            tabId={activeTab.id}
          />
        </div>
      )}
    </div>
  );
}
