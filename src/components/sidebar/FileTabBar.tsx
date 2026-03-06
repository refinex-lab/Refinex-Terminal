import React, { useState, useEffect, useRef } from "react";
import { X, ChevronDown, MoreVertical, Save, Search, ExternalLink } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useFileEditorStore, type FileTab } from "@/stores/file-editor-store";
import { getFileIcon } from "@/lib/file-icons";

interface SortableTabProps {
  tab: FileTab;
  onClose: (e: React.MouseEvent, tabId: string) => void;
  onContextMenu: (e: React.MouseEvent, tab: FileTab) => void;
  onActivate: (tabId: string) => void;
}

function SortableTab({ tab, onClose, onContextMenu, onActivate }: SortableTabProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    borderColor: "var(--ui-border)",
    backgroundColor: tab.isActive ? "var(--ui-button-background)" : "transparent",
    maxWidth: "200px",
  };

  const iconConfig = getFileIcon(tab.name, false);
  const Icon = iconConfig.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="group flex items-center gap-2 px-3 py-2 border-r cursor-grab active:cursor-grabbing hover:bg-white/5 transition-colors flex-shrink-0"
      onClick={() => onActivate(tab.id)}
      onContextMenu={(e) => onContextMenu(e, tab)}
    >
      <Icon
        className="size-4 flex-shrink-0"
        style={{ color: iconConfig.color, opacity: 0.9 }}
      />
      <span
        className="text-xs truncate flex-1"
        style={{ color: "var(--ui-foreground)" }}
        title={tab.path}
      >
        {tab.name}
      </span>
      <button
        onClick={(e) => onClose(e, tab.id)}
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 transition-all"
        style={{ color: "var(--ui-foreground)" }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

interface FileTabBarProps {
  className?: string;
  onSaveAll?: () => void;
  showSearch: boolean;
  onSearchToggle: () => void;
}

export function FileTabBar({ className = "", onSaveAll, onSearchToggle }: FileTabBarProps) {
  const { tabs, setActiveTab, removeTab, closeAllTabs, closeOtherTabs, closeTabsToRight, reorderTabs } = useFileEditorStore();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tab: FileTab } | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [confirmClose, setConfirmClose] = useState<{ tabId: string; tabName: string } | null>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to start drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = tabs.findIndex((tab) => tab.id === active.id);
      const newIndex = tabs.findIndex((tab) => tab.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        reorderTabs(oldIndex, newIndex);
      }
    }
  };

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    const handleContextMenuGlobal = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener("click", handleClick);
      document.addEventListener("contextmenu", handleContextMenuGlobal);
      return () => {
        document.removeEventListener("click", handleClick);
        document.removeEventListener("contextmenu", handleContextMenuGlobal);
      };
    }
  }, [contextMenu]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) {
      document.addEventListener("click", handleClick);
      return () => document.removeEventListener("click", handleClick);
    }
  }, [showDropdown]);

  const handleContextMenu = (e: React.MouseEvent, tab: FileTab) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, tab });
  };

  const handleCloseTab = async (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();

    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    // If tab has unsaved changes, auto-save before closing
    if (tab.isDirty && tab.content) {
      try {
        await invoke("write_file", { path: tab.path, content: tab.content });
      } catch (err) {
        console.error("Failed to auto-save before closing:", err);
        // Show confirmation dialog if auto-save fails
        setConfirmClose({ tabId, tabName: tab.name });
        return;
      }
    }

    removeTab(tabId);
  };

  if (tabs.length === 0) return null;

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div
          ref={tabBarRef}
          className={`flex items-center border-b ${className}`}
          style={{ borderColor: "var(--ui-border)", backgroundColor: "var(--ui-background)" }}
        >
          {/* Scrollable tab list */}
          <SortableContext
            items={tabs.map((tab) => tab.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex items-center overflow-x-auto scrollbar-thin" style={{ scrollbarWidth: "thin", flex: "1 1 0", minWidth: 0 }}>
              {tabs.map((tab) => (
                <SortableTab
                  key={tab.id}
                  tab={tab}
                  onClose={handleCloseTab}
                  onContextMenu={handleContextMenu}
                  onActivate={setActiveTab}
                />
              ))}
            </div>
          </SortableContext>

        {/* Action buttons - always visible */}
        <div className="flex items-center flex-shrink-0" style={{ flex: "0 0 auto" }}>
          {/* Dropdown button */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="p-2 border-l hover:bg-white/5 transition-colors"
              style={{ borderColor: "var(--ui-border)", color: "var(--ui-foreground)" }}
              title="Show all tabs"
            >
              <ChevronDown className="size-4" />
            </button>

          {/* Dropdown menu */}
          {showDropdown && (
            <div
              className="absolute right-0 top-full mt-1 py-1 rounded-lg shadow-lg z-50"
              style={{
                backgroundColor: "var(--ui-background)",
                border: "1px solid var(--ui-border)",
                minWidth: "200px",
                maxHeight: "300px",
                overflowY: "auto",
              }}
            >
              {tabs.map((tab) => {
                const iconConfig = getFileIcon(tab.name, false);
                const Icon = iconConfig.icon;

                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setShowDropdown(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors"
                    style={{
                      color: "var(--ui-foreground)",
                      backgroundColor: tab.isActive ? "var(--ui-button-background)" : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (!tab.isActive) {
                        e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!tab.isActive) {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }
                    }}
                    title={tab.path}
                  >
                    <Icon
                      className="size-4 flex-shrink-0"
                      style={{ color: iconConfig.color, opacity: 0.9 }}
                    />
                    <span className="truncate flex-1 text-left" title={tab.path}>
                      {tab.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          </div>

          {/* Search button */}
          <button
            onClick={onSearchToggle}
            className="p-2 border-l hover:bg-white/5 transition-colors"
            style={{ borderColor: "var(--ui-border)", color: "var(--ui-foreground)" }}
            title="Search (Cmd/Ctrl+F)"
          >
            <Search className="size-4" />
          </button>
        </div>
      </div>
      </DndContext>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 py-1 rounded-lg shadow-lg"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
            backgroundColor: "var(--ui-background)",
            border: "1px solid var(--ui-border)",
            minWidth: "180px",
          }}
        >
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors"
            style={{ color: "var(--ui-foreground)" }}
            onClick={async () => {
              try {
                await invoke("reveal_in_finder", { path: contextMenu.tab.path });
                setContextMenu(null);
              } catch (err) {
                console.error("Failed to reveal in finder:", err);
              }
            }}
          >
            <ExternalLink className="size-4" />
            Reveal in Finder
          </button>
          <div className="h-px my-1" style={{ backgroundColor: "var(--ui-border)" }} />
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors"
            style={{ color: "var(--ui-foreground)" }}
            onClick={() => {
              removeTab(contextMenu.tab.id);
              setContextMenu(null);
            }}
          >
            <X className="size-4" />
            Close
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors"
            style={{ color: "var(--ui-foreground)" }}
            onClick={() => {
              closeOtherTabs(contextMenu.tab.id);
              setContextMenu(null);
            }}
          >
            <MoreVertical className="size-4" />
            Close Others
          </button>
          <button
            className="w-full flex items-center gap-x-3 py-2 text-sm hover:bg-white/5 transition-colors"
            style={{ color: "var(--ui-foreground)" }}
            onClick={() => {
              closeTabsToRight(contextMenu.tab.id);
              setContextMenu(null);
            }}
          >
            <MoreVertical className="size-4" />
            Close to the Right
          </button>
          <div className="h-px my-1" style={{ backgroundColor: "var(--ui-border)" }} />
          {onSaveAll && tabs.some(t => t.isDirty) && (
            <>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors"
                style={{ color: "var(--ui-foreground)" }}
                onClick={() => {
                  onSaveAll();
                  setContextMenu(null);
                }}
              >
                <Save className="size-4" />
                Save All
              </button>
              <div className="h-px my-1" style={{ backgroundColor: "var(--ui-border)" }} />
            </>
          )}
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors"
            style={{ color: "var(--ui-foreground)" }}
            onClick={() => {
              closeAllTabs();
              setContextMenu(null);
            }}
          >
            <X className="size-4" />
            Close All
          </button>
        </div>
      )}

      {/* Confirm Close Dialog */}
      {confirmClose && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
          onClick={() => setConfirmClose(null)}
        >
          <div
            className="rounded-lg p-6 shadow-xl"
            style={{
              backgroundColor: "var(--ui-background)",
              border: "1px solid var(--ui-border)",
              maxWidth: "400px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--ui-foreground)" }}>
              Unsaved Changes
            </h3>
            <p className="text-sm mb-4" style={{ color: "var(--ui-muted-foreground)" }}>
              File "{confirmClose.tabName}" has unsaved changes. Do you want to save before closing?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmClose(null)}
                className="px-3 py-1.5 text-sm rounded hover:bg-white/10 transition-colors"
                style={{ color: "var(--ui-foreground)" }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  removeTab(confirmClose.tabId);
                  setConfirmClose(null);
                }}
                className="px-3 py-1.5 text-sm rounded hover:bg-white/10 transition-colors"
                style={{ color: "var(--ui-foreground)" }}
              >
                Don't Save
              </button>
              <button
                onClick={async () => {
                  const tab = tabs.find(t => t.id === confirmClose.tabId);
                  if (tab?.content) {
                    try {
                      await invoke("write_file", { path: tab.path, content: tab.content });
                      removeTab(confirmClose.tabId);
                    } catch (err) {
                      alert(`Failed to save: ${err}`);
                    }
                  }
                  setConfirmClose(null);
                }}
                className="px-3 py-1.5 text-sm rounded transition-colors"
                style={{
                  backgroundColor: "var(--ui-button-background)",
                  color: "var(--ui-foreground)",
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
