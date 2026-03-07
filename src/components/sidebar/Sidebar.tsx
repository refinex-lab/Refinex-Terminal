import { useState, useRef, useEffect } from "react";
import { FolderOpen, MoreVertical, Terminal, Copy, X, FilePlus, ChevronsDownUp, FolderPlus, Search, GitBranch } from "lucide-react";
import { BsFolderPlus, BsFolder } from "react-icons/bs";
import { useSidebarStore, type Project } from "@/stores/sidebar-store";
import { useConfigStore } from "@/stores/config-store";
import { useTerminalStore } from "@/stores/terminal-store";
import { useFileEditorStore } from "@/stores/file-editor-store";
import { Logo } from "@/components/ui/Logo";
import { open } from "@tauri-apps/plugin-dialog";
import { FileTree } from "./FileTree";
import { GitPanel } from "@/components/git/GitPanel";

interface SidebarProps {
  className?: string;
  onOpenFileFinder?: () => void;
}

export function Sidebar({ className = "", onOpenFileFinder }: SidebarProps) {
  const { isVisible, width, projects, activeProjectId, setWidth, addProject, removeProject, setActiveProject } = useSidebarStore();
  const { config, updateConfig } = useConfigStore();
  const { addSession } = useTerminalStore();
  const { addTab } = useFileEditorStore();
  const [isResizing, setIsResizing] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; project: Project } | null>(null);
  const [triggerCreate, setTriggerCreate] = useState<{ type: "file" | "folder" } | null>(null);
  const [triggerCollapseAll, setTriggerCollapseAll] = useState(false);
  const [showGitPanel, setShowGitPanel] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const handleFileClick = (filePath: string, fileName: string) => {
    addTab(filePath, fileName);
  };

  // Handle resize
  const handleMouseDown = () => {
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = e.clientX;
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, setWidth]);

  // Load projects from config on mount
  useEffect(() => {
    const projectPaths = (config as any).projects?.paths || [];
    if (projectPaths.length > 0) {
      useSidebarStore.getState().loadProjects(projectPaths);
    }
  }, []);

  // Save projects to config when they change
  useEffect(() => {
    const projectPaths = projects.map((p) => p.path);
    updateConfig({
      ...config,
      projects: {
        paths: projectPaths,
      },
    } as any);
  }, [projects]);

  // Handle add project
  const handleAddProject = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Project Folder",
      });

      if (selected && typeof selected === "string") {
        addProject(selected);
      }
    } catch (error) {
      console.error("Failed to open folder picker:", error);
    }
  };

  // Handle context menu
  const handleContextMenu = (e: React.MouseEvent, project: Project) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, project });
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

  // Handle context menu actions
  const handleOpenInTerminal = (project: Project) => {
    addSession({
      id: `terminal-${Date.now()}`,
      title: "Terminal",
      cwd: project.path,
      ptyId: null,
    });
    setContextMenu(null);
  };

  const handleCopyPath = async (project: Project) => {
    try {
      await navigator.clipboard.writeText(project.path);
    } catch (error) {
      console.error("Failed to copy path:", error);
    }
    setContextMenu(null);
  };

  const handleRemoveProject = (project: Project) => {
    removeProject(project.id);
    setContextMenu(null);
  };

  const handleNewFile = (_project: Project) => {
    setTriggerCreate({ type: "file" });
    setContextMenu(null);
  };

  const handleNewFolder = (_project: Project) => {
    setTriggerCreate({ type: "folder" });
    setContextMenu(null);
  };

  const handleCollapseAll = () => {
    setTriggerCollapseAll(true);
    setContextMenu(null);
    // Reset trigger after a short delay
    setTimeout(() => setTriggerCollapseAll(false), 100);
  };

  if (!isVisible) return null;

  return (
    <>
      <div
        ref={sidebarRef}
        className={`relative flex flex-col ${className}`}
        style={{
          width: `${width}px`,
          minWidth: "200px",
          maxWidth: "400px",
          backgroundColor: "var(--ui-background)",
          borderRight: "1px solid var(--ui-border)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: "var(--ui-border)" }}
        >
          <div className="flex items-center gap-2">
            <Logo size={20} />
            <span
              className="text-sm font-semibold"
              style={{ color: "var(--ui-foreground)" }}
            >
              Projects
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowGitPanel(!showGitPanel)}
              className="p-1.5 rounded hover:bg-white/10 transition-colors"
              style={{
                color: "var(--ui-foreground)",
                backgroundColor: showGitPanel ? "var(--ui-button-background)" : "transparent"
              }}
              title="Git Panel"
            >
              <GitBranch className="size-4" />
            </button>
            <button
              onClick={onOpenFileFinder}
              className="p-1.5 rounded hover:bg-white/10 transition-colors"
              style={{ color: "var(--ui-foreground)" }}
              title="Search Files (Cmd/Ctrl+P)"
            >
              <Search className="size-4" />
            </button>
            <button
              onClick={handleAddProject}
              className="p-1.5 rounded hover:bg-white/10 transition-colors"
              style={{ color: "var(--ui-foreground)" }}
              title="Add Project"
            >
              <BsFolderPlus className="size-4" />
            </button>
          </div>
        </div>

        {/* Project List and File Tree */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {showGitPanel ? (
            <GitPanel />
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-4 text-center">
              <BsFolder
                className="size-12 mb-3"
                style={{ color: "var(--ui-foreground)", opacity: 0.3 }}
              />
              <p
                className="text-sm mb-2"
                style={{ color: "var(--ui-foreground)", opacity: 0.7 }}
              >
                No projects yet
              </p>
              <button
                onClick={handleAddProject}
                className="text-xs px-3 py-1.5 rounded"
                style={{
                  backgroundColor: "var(--ui-button-background)",
                  color: "var(--ui-foreground)",
                }}
              >
                Add your first project
              </button>
            </div>
          ) : (
            <>
              {/* Project List */}
              <div className="border-b" style={{ borderColor: "var(--ui-border)" }}>
                <div className="py-2">
                  {projects.map((project) => (
                    <div
                      key={project.id}
                      className="group flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-white/5 transition-colors"
                      style={{
                        backgroundColor:
                          activeProjectId === project.id
                            ? "var(--ui-button-background)"
                            : "transparent",
                      }}
                      onClick={() => setActiveProject(project.id)}
                      onContextMenu={(e) => handleContextMenu(e, project)}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FolderOpen className="size-4 flex-shrink-0" style={{ color: "var(--ui-foreground)", opacity: 0.7 }} />
                        <span
                          className="text-sm truncate"
                          style={{ color: "var(--ui-foreground)" }}
                          title={project.path}
                        >
                          {project.name}
                        </span>
                      </div>
                      <button
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleContextMenu(e, project);
                        }}
                        style={{ color: "var(--ui-foreground)" }}
                      >
                        <MoreVertical className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* File Tree */}
              {activeProjectId && (
                <FileTree
                  projectPath={projects.find((p) => p.id === activeProjectId)?.path || ""}
                  className="flex-1"
                  triggerCreate={triggerCreate}
                  onCreateComplete={() => setTriggerCreate(null)}
                  triggerCollapseAll={triggerCollapseAll}
                  onFileClick={handleFileClick}
                />
              )}
            </>
          )}
        </div>

        {/* Resize Handle */}
        <div
          className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500/50 transition-colors"
          onMouseDown={handleMouseDown}
          style={{
            backgroundColor: isResizing ? "rgba(59, 130, 246, 0.5)" : "transparent",
          }}
        />
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
            onClick={() => handleOpenInTerminal(contextMenu.project)}
          >
            <Terminal className="size-4" />
            Open in Terminal
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors"
            style={{ color: "var(--ui-foreground)" }}
            onClick={() => handleNewFile(contextMenu.project)}
          >
            <FilePlus className="size-4" />
            New File
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors"
            style={{ color: "var(--ui-foreground)" }}
            onClick={() => handleNewFolder(contextMenu.project)}
          >
            <FolderPlus className="size-4" />
            New Folder
          </button>
          <div className="h-px my-1" style={{ backgroundColor: "var(--ui-border)" }} />
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors"
            style={{ color: "var(--ui-foreground)" }}
            onClick={handleCollapseAll}
          >
            <ChevronsDownUp className="size-4" />
            Collapse All
          </button>
          <div className="h-px my-1" style={{ backgroundColor: "var(--ui-border)" }} />
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors"
            style={{ color: "var(--ui-foreground)" }}
            onClick={() => handleCopyPath(contextMenu.project)}
          >
            <Copy className="size-4" />
            Copy Path
          </button>
          <div className="h-px my-1" style={{ backgroundColor: "var(--ui-border)" }} />
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors text-red-500"
            onClick={() => handleRemoveProject(contextMenu.project)}
          >
            <X className="size-4" />
            Remove from Sidebar
          </button>
        </div>
      )}
    </>
  );
}
