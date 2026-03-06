import { useState, useEffect, useRef } from "react";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { useSidebarStore } from "@/stores/sidebar-store";
import { useFileEditorStore } from "@/stores/file-editor-store";
import { listAllFiles, fuzzyFilter } from "@/lib/fuzzy-finder";
import { getFileIcon } from "@/lib/file-icons";

interface FuzzyFileFinderProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FuzzyFileFinder({ isOpen, onClose }: FuzzyFileFinderProps) {
  const { projects, activeProjectId } = useSidebarStore();
  const { addTab } = useFileEditorStore();
  const [search, setSearch] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeProject = projects.find((p) => p.id === activeProjectId);

  // Load files when opened
  useEffect(() => {
    if (isOpen && activeProject) {
      setSearch("");
      setIsLoading(true);

      // Default ignore patterns
      const ignorePatterns = [
        ".DS_Store",
        "*.pyc",
        "*.swp",
        "*.swo",
        "*.swx",
      ];

      listAllFiles(activeProject.path, ignorePatterns)
        .then((fileList) => {
          setFiles(fileList);
          setIsLoading(false);
        })
        .catch((error) => {
          console.error("Failed to list files:", error);
          setIsLoading(false);
        });

      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen, activeProject]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleSelect = (filePath: string) => {
    const fileName = filePath.split("/").pop() || filePath;
    addTab(filePath, fileName);
    onClose();
  };

  // Filter files by fuzzy match
  const filteredFiles = fuzzyFilter(files, search, 50);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-lg shadow-2xl"
        style={{
          backgroundColor: "var(--ui-background)",
          border: "1px solid var(--ui-border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Command>
          <CommandInput
            ref={inputRef}
            placeholder={
              activeProject
                ? `Search files in ${activeProject.name}...`
                : "No active project"
            }
            value={search}
            onValueChange={setSearch}
            style={{
              color: "var(--ui-foreground)",
            }}
            disabled={!activeProject}
          />
          <CommandList className="max-h-[400px] overflow-y-auto">
            {isLoading ? (
              <div className="py-6 text-center" style={{ color: "var(--ui-muted-foreground)" }}>
                Loading files...
              </div>
            ) : !activeProject ? (
              <div className="py-6 text-center" style={{ color: "var(--ui-muted-foreground)" }}>
                No active project selected
              </div>
            ) : (
              <>
                <CommandEmpty>
                  <div className="py-6 text-center" style={{ color: "var(--ui-muted-foreground)" }}>
                    No files found
                  </div>
                </CommandEmpty>
                <CommandGroup>
                  {filteredFiles.map(({ path, score }) => {
                    const fileName = path.split("/").pop() || path;
                    const relativePath = activeProject
                      ? path.replace(activeProject.path + "/", "")
                      : path;
                    const iconConfig = getFileIcon(fileName, false);
                    const IconComponent = iconConfig.icon;

                    return (
                      <CommandItem
                        key={path}
                        value={path}
                        onSelect={() => handleSelect(path)}
                        className="flex items-center gap-3 px-4 py-2 cursor-pointer"
                        style={{
                          color: "var(--ui-foreground)",
                        }}
                      >
                        <IconComponent
                          className="size-4 flex-shrink-0"
                          style={{ color: iconConfig.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{fileName}</div>
                          <div
                            className="text-xs truncate"
                            style={{ color: "var(--ui-muted-foreground)" }}
                          >
                            {relativePath}
                          </div>
                        </div>
                        {search && (
                          <div
                            className="text-xs px-2 py-0.5 rounded"
                            style={{
                              backgroundColor: "var(--ui-accent)",
                              color: "var(--ui-accent-foreground)",
                              opacity: 0.6,
                            }}
                          >
                            {Math.round(score * 100)}%
                          </div>
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </div>
    </div>
  );
}
