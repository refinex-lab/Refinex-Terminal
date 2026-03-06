import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { useFileEditorStore } from "@/stores/file-editor-store";
import { useSettingsStore } from "@/stores/settings-store";
import { FileTabBar } from "./FileTabBar";
import { FilePreview } from "./FilePreview";

interface FileEditorPanelProps {
  className?: string;
}

export function FileEditorPanel({ className = "" }: FileEditorPanelProps) {
  const { tabs, activeTabId, updateTabDirty } = useFileEditorStore();
  const { autoSave } = useSettingsStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const [isSavingAll, setIsSavingAll] = useState(false);

  const dirtyTabs = tabs.filter(tab => tab.isDirty && tab.content);

  // Save all files
  const handleSaveAll = useCallback(async () => {
    if (isSavingAll || dirtyTabs.length === 0) return;

    setIsSavingAll(true);
    let successCount = 0;
    let failCount = 0;

    const toastId = toast.loading(`Saving ${dirtyTabs.length} file${dirtyTabs.length > 1 ? 's' : ''}...`);

    for (const tab of dirtyTabs) {
      try {
        await invoke("write_file", { path: tab.path, content: tab.content });
        updateTabDirty(tab.id, false);
        successCount++;
      } catch (err) {
        console.error(`Failed to save ${tab.name}:`, err);
        failCount++;
      }
    }

    setIsSavingAll(false);

    // Show result toast
    if (failCount === 0) {
      toast.success(`Saved ${successCount} file${successCount > 1 ? 's' : ''}`, {
        id: toastId,
        duration: 2000,
      });
    } else {
      toast.error(`Saved ${successCount}, failed ${failCount}`, {
        id: toastId,
        duration: 4000,
      });
    }
  }, [dirtyTabs, isSavingAll, updateTabDirty]);

  // Keyboard shortcut: Cmd+K S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        // Wait for next key
        const handleNextKey = (e2: KeyboardEvent) => {
          if (e2.key === "s") {
            e2.preventDefault();
            handleSaveAll();
          }
          document.removeEventListener("keydown", handleNextKey);
        };
        document.addEventListener("keydown", handleNextKey);
        setTimeout(() => {
          document.removeEventListener("keydown", handleNextKey);
        }, 1000);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleSaveAll]);

  // Auto-save on window blur (lose focus)
  useEffect(() => {
    if (!autoSave.enabled || !autoSave.onWindowChange) {
      return;
    }

    const handleWindowBlur = async () => {
      // Save all tabs with unsaved changes
      const dirtyTabs = tabs.filter(tab => tab.isDirty && tab.content);

      for (const tab of dirtyTabs) {
        try {
          await invoke("write_file", { path: tab.path, content: tab.content });
          console.log(`Auto-saved on window blur: ${tab.name}`);
        } catch (err) {
          console.error(`Failed to auto-save ${tab.name} on window blur:`, err);
        }
      }
    };

    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [autoSave.enabled, autoSave.onWindowChange, tabs]);

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-col h-full ${className}`} style={{ backgroundColor: "var(--ui-background)" }}>
      <FileTabBar onSaveAll={handleSaveAll} />
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
