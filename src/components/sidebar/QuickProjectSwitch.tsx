import { useState, useEffect, useRef } from "react";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { useSidebarStore } from "@/stores/sidebar-store";
import { useTerminalStore } from "@/stores/terminal-store";
import { BsFolder } from "react-icons/bs";

interface QuickProjectSwitchProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QuickProjectSwitch({
  isOpen,
  onClose,
}: QuickProjectSwitchProps) {
  const { projects, setActiveProject } = useSidebarStore();
  const { addSession } = useTerminalStore();
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

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

  const handleSelect = (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;

    // Set as active project
    setActiveProject(projectId);

    // Open new terminal tab in project directory
    addSession({
      id: `terminal-${Date.now()}`,
      title: project.name,
      cwd: project.path,
      ptyId: null,
    });

    onClose();
  };

  // Filter projects by search
  const filteredProjects = projects.filter(
    (project) =>
      project.name.toLowerCase().includes(search.toLowerCase()) ||
      project.path.toLowerCase().includes(search.toLowerCase()),
  );

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
            placeholder="Search projects..."
            value={search}
            onValueChange={setSearch}
            style={{
              color: "var(--ui-foreground)",
            }}
          />
          <CommandList className="max-h-[400px] overflow-y-auto">
            <CommandEmpty>
              <div
                className="py-6 text-center"
                style={{ color: "var(--ui-muted-foreground)" }}
              >
                No projects found
              </div>
            </CommandEmpty>
            <CommandGroup>
              {filteredProjects.map((project) => (
                <CommandItem
                  key={project.id}
                  value={project.id}
                  onSelect={() => handleSelect(project.id)}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                  style={{
                    color: "var(--ui-foreground)",
                  }}
                >
                  <BsFolder
                    className="size-5 flex-shrink-0"
                    style={{ color: "var(--ui-muted-foreground)" }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{project.name}</div>
                    <div
                      className="text-sm truncate"
                      style={{ color: "var(--ui-muted-foreground)" }}
                    >
                      {project.path}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </div>
    </div>
  );
}
