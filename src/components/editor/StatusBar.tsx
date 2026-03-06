import { useFileEditorStore } from "@/stores/file-editor-store";
import { useSettingsStore } from "@/stores/settings-store";
import { Check, AlertCircle } from "lucide-react";

export function StatusBar() {
  const { tabs } = useFileEditorStore();
  const { autoSave } = useSettingsStore();

  const dirtyTabs = tabs.filter(tab => tab.isDirty);
  const dirtyCount = dirtyTabs.length;

  // Determine status message
  let statusMessage = "";
  let StatusIcon = Check;
  let iconColor = "var(--ui-muted-foreground)";

  if (dirtyCount > 0) {
    statusMessage = `${dirtyCount} unsaved ${dirtyCount === 1 ? 'file' : 'files'}`;
    StatusIcon = AlertCircle;
    iconColor = "orange";
  } else {
    statusMessage = "All files saved";
    StatusIcon = Check;
    iconColor = "green";
  }

  return (
    <div
      className="fixed bottom-0 right-0 px-4 py-2 flex items-center gap-4 text-xs border-t border-l rounded-tl-lg"
      style={{
        backgroundColor: "var(--ui-background)",
        borderColor: "var(--ui-border)",
        color: "var(--ui-muted-foreground)",
        zIndex: 40,
      }}
    >
      {/* Auto-save mode indicator */}
      {autoSave.enabled && (
        <div className="flex items-center gap-1.5">
          <div
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: "green" }}
          />
          <span>Auto-save: {autoSave.afterDelay > 0 ? `${autoSave.afterDelay}ms` : 'Instant'}</span>
        </div>
      )}

      {/* File status */}
      <div className="flex items-center gap-1.5">
        <StatusIcon className="size-3.5" style={{ color: iconColor }} />
        <span>{statusMessage}</span>
      </div>
    </div>
  );
}
