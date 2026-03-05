import { useState, useEffect, useRef } from "react";
import { X, ChevronDown, MoreVertical } from "lucide-react";
import { useFileEditorStore, type FileTab } from "@/stores/file-editor-store";
import { getFileIcon } from "@/lib/file-icons";

interface FileTabBarProps {
  className?: string;
}

export function FileTabBar({ className = "" }: FileTabBarProps) {
  const { tabs, setActiveTab, removeTab, closeAllTabs, closeOtherTabs, closeTabsToRight } = useFileEditorStore();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tab: FileTab } | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const tabBarRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    removeTab(tabId);
  };

  if (tabs.length === 0) return null;

  return (
    <>
      <div
        ref={tabBarRef}
        className={`flex items-center border-b ${className}`}
        style={{ borderColor: "var(--ui-border)", backgroundColor: "var(--ui-background)" }}
      >
        {/* Scrollable tab list */}
        <div className="flex-1 flex items-center overflow-x-auto scrollbar-thin" style={{ scrollbarWidth: "thin" }}>
          {tabs.map((tab) => {
            const iconConfig = getFileIcon(tab.name, false);
            const Icon = iconConfig.icon;

            return (
              <div
                key={tab.id}
                className="group flex items-center gap-2 px-3 py-2 border-r cursor-pointer hover:bg-white/5 transition-colors flex-shrink-0"
                style={{
                  borderColor: "var(--ui-border)",
                  backgroundColor: tab.isActive ? "var(--ui-button-background)" : "transparent",
                  maxWidth: "200px",
                }}
                onClick={() => setActiveTab(tab.id)}
                onContextMenu={(e) => handleContextMenu(e, tab)}
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
                  {tab.isDirty && <span style={{ color: "var(--ui-foreground)", opacity: 0.7 }}> •</span>}
                </span>
                <button
                  onClick={(e) => handleCloseTab(e, tab.id)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 transition-all"
                  style={{ color: "var(--ui-foreground)" }}
                >
                  <X className="size-3" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Dropdown button */}
        {tabs.length > 0 && (
          <div className="relative flex-shrink-0" ref={dropdownRef}>
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
                        {tab.isDirty && " •"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

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
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors"
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
    </>
  );
}
