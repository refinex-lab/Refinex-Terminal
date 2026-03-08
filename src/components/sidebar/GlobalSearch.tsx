import { useState, useEffect, useRef } from "react";
import {
  Search,
  X,
  ChevronDown,
  ChevronRight,
  Replace,
  CaseSensitive,
  WholeWord,
  Regex,
  FolderOpen,
  Check,
  RefreshCw,
  File,
  Folder,
} from "lucide-react";
import { useSidebarStore } from "@/stores/sidebar-store";
import { useFileEditorStore } from "@/stores/file-editor-store";
import { getFileIcon } from "@/lib/file-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { invoke } from "@tauri-apps/api/core";

interface SearchMatch {
  filePath: string;
  lineNumber: number;
  lineContent: string;
  matchStart: number;
  matchEnd: number;
  contextBefore: string;
  contextAfter: string;
}

interface SearchResult {
  filePath: string;
  matches: SearchMatch[];
}

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  showReplace?: boolean;
}

interface DirectoryNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: DirectoryNode[];
}

export function GlobalSearch({ isOpen, onClose, showReplace = false }: GlobalSearchProps) {
  const { projects, activeProjectId } = useSidebarStore();
  const { addTab, openFileAtLine } = useFileEditorStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [selectedDirectory, setSelectedDirectory] = useState<string>("");
  const [isReplaceExpanded, setIsReplaceExpanded] = useState(showReplace);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [replacedMatches, setReplacedMatches] = useState<Set<string>>(new Set());
  const [showDirectoryPicker, setShowDirectoryPicker] = useState(false);
  const [directoryTree, setDirectoryTree] = useState<DirectoryNode[]>([]);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  const searchInputRef = useRef<HTMLInputElement>(null);
  const activeProject = projects.find((p) => p.id === activeProjectId);

  // Initialize directory selection and load directory tree
  useEffect(() => {
    if (isOpen && activeProject) {
      if (!selectedDirectory) {
        setSelectedDirectory(activeProject.path);
      }
      // Load directory tree
      loadDirectoryTree(activeProject.path);
    }
  }, [isOpen, activeProject]);

  // Load directory tree
  const loadDirectoryTree = async (path: string) => {
    try {
      const entries = await invoke<Array<{
        name: string;
        path: string;
        is_directory: boolean;
      }>>("read_directory", { path });

      const dirs = entries
        .filter((e) => e.is_directory)
        .map((e) => ({
          name: e.name,
          path: e.path,
          isDirectory: true,
          children: undefined, // Mark as expandable
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      setDirectoryTree(dirs);
    } catch (error) {
      console.error("Failed to load directory tree:", error);
    }
  };

  // Toggle directory expansion in picker
  const toggleDirExpansion = async (dirPath: string) => {
    const newExpanded = new Set(expandedDirs);
    if (newExpanded.has(dirPath)) {
      newExpanded.delete(dirPath);
    } else {
      newExpanded.add(dirPath);
      // Load subdirectories
      try {
        const entries = await invoke<Array<{
          name: string;
          path: string;
          is_directory: boolean;
        }>>("read_directory", { path: dirPath });

        const subdirs = entries
          .filter((e) => e.is_directory)
          .map((e) => ({
            name: e.name,
            path: e.path,
            isDirectory: true,
            children: undefined, // Mark as expandable
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

        // Update directory tree with subdirectories
        setDirectoryTree((prev) => {
          const updateTree = (nodes: DirectoryNode[]): DirectoryNode[] => {
            return nodes.map((node) => {
              if (node.path === dirPath) {
                return { ...node, children: subdirs };
              }
              if (node.children) {
                return { ...node, children: updateTree(node.children) };
              }
              return node;
            });
          };
          return updateTree(prev);
        });
      } catch (error) {
        console.error("Failed to load subdirectories:", error);
      }
    }
    setExpandedDirs(newExpanded);
  };

  // Render directory tree recursively
  const renderDirectoryTree = (nodes: DirectoryNode[], depth: number = 0) => {
    return nodes.map((node) => {
      const isExpanded = expandedDirs.has(node.path);
      const isSelected = selectedDirectory === node.path;
      const hasChildren = node.children && node.children.length > 0;

      return (
        <div key={node.path}>
          <div
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-white/5 transition-colors"
            style={{
              paddingLeft: `${0.75 + depth * 1}rem`,
              backgroundColor: isSelected ? "rgba(59, 130, 246, 0.1)" : undefined,
              color: isSelected ? "var(--ui-accent)" : "var(--ui-foreground)",
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleDirExpansion(node.path);
              }}
              className="p-0.5 hover:bg-white/10 rounded flex-shrink-0"
            >
              {isExpanded ? (
                <ChevronDown className="size-3" />
              ) : (
                <ChevronRight className="size-3" />
              )}
            </button>
            <button
              onClick={() => {
                setSelectedDirectory(node.path);
                setShowDirectoryPicker(false);
              }}
              className="flex items-center gap-2 flex-1 min-w-0 text-left"
            >
              <Folder className="size-3.5 flex-shrink-0" style={{ color: "var(--ui-accent)" }} />
              <span className="truncate">{node.name}</span>
            </button>
          </div>
          {isExpanded && hasChildren && node.children && (
            <div>{renderDirectoryTree(node.children, depth + 1)}</div>
          )}
        </div>
      );
    });
  };

  // Focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 0);
      setIsReplaceExpanded(showReplace);
    }
  }, [isOpen, showReplace]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSearch();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, searchQuery]);

  const handleSearch = async () => {
    if (!searchQuery.trim() || !selectedDirectory) return;

    setIsSearching(true);
    setResults([]);
    setExpandedFiles(new Set());
    setReplacedMatches(new Set());

    try {
      const searchResults = await searchInFiles(
        selectedDirectory,
        searchQuery,
        caseSensitive,
        wholeWord,
        useRegex
      );
      setResults(searchResults);

      // Auto-expand first file if results exist
      if (searchResults.length > 0 && searchResults[0]) {
        setExpandedFiles(new Set([searchResults[0].filePath]));
      }
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const toggleFileExpansion = (filePath: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  };

  const handleMatchClick = (match: SearchMatch) => {
    const fileName = match.filePath.split("/").pop() || match.filePath;
    addTab(match.filePath, fileName);
    openFileAtLine(match.filePath, match.lineNumber);
    onClose();
  };

  const handleReplaceOne = async (match: SearchMatch) => {
    const matchKey = `${match.filePath}:${match.lineNumber}:${match.matchStart}`;

    try {
      await replaceInFile(match.filePath, match.lineNumber, match.matchStart, match.matchEnd, replaceText);
      setReplacedMatches((prev) => new Set(prev).add(matchKey));
    } catch (error) {
      console.error("Replace failed:", error);
    }
  };

  const handleReplaceAll = async () => {
    if (replaceText === undefined || replaceText === null) return;

    const allMatches = results.flatMap((result) => result.matches);

    for (const match of allMatches) {
      const matchKey = `${match.filePath}:${match.lineNumber}:${match.matchStart}`;
      if (!replacedMatches.has(matchKey)) {
        try {
          await replaceInFile(match.filePath, match.lineNumber, match.matchStart, match.matchEnd, replaceText);
          setReplacedMatches((prev) => new Set(prev).add(matchKey));
        } catch (error) {
          console.error("Replace failed:", error);
        }
      }
    }
  };

  const totalMatches = results.reduce((sum, result) => sum + result.matches.length, 0);
  const totalFiles = results.length;

  // Get directory name for display
  const getDirectoryName = (path: string) => {
    if (!activeProject) return path;
    if (path === activeProject.path) return activeProject.name;
    return path.split("/").pop() || path;
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh]"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl rounded-lg shadow-2xl flex flex-col max-h-[84vh]"
        style={{
          backgroundColor: "var(--ui-background)",
          border: "1px solid var(--ui-border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact Header */}
        <div
          className="px-4 py-2 border-b flex items-center justify-between"
          style={{ borderColor: "var(--ui-border)" }}
        >
          <div className="flex items-center gap-2">
            <Search className="size-4" style={{ color: "var(--ui-muted-foreground)" }} />
            <span className="text-sm font-medium" style={{ color: "var(--ui-foreground)" }}>
              Find in Files
            </span>
            {results.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded" style={{
                backgroundColor: "var(--ui-accent)",
                color: "var(--ui-accent-foreground)",
                opacity: 0.8
              }}>
                {totalMatches} {totalMatches === 1 ? "result" : "results"} in {totalFiles} {totalFiles === 1 ? "file" : "files"}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            style={{ color: "var(--ui-muted-foreground)" }}
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Compact Search Controls */}
        <div className="px-4 py-3 space-y-2 border-b" style={{ borderColor: "var(--ui-border)" }}>
          {/* Search Input Row */}
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Input
                ref={searchInputRef}
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
                    handleSearch();
                  }
                }}
                className="pr-28 h-8 text-sm"
                style={{
                  backgroundColor: "var(--ui-background)",
                  borderColor: "var(--ui-border)",
                  color: "var(--ui-foreground)",
                }}
              />

              {/* Search Options - Inside Input */}
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                <button
                  onClick={() => setCaseSensitive(!caseSensitive)}
                  className={`p-1 rounded transition-colors ${
                    caseSensitive ? "bg-blue-500/20" : "hover:bg-white/10"
                  }`}
                  title="Match Case (Alt+C)"
                  style={{ color: caseSensitive ? "#3b82f6" : "var(--ui-muted-foreground)" }}
                >
                  <CaseSensitive className="size-3.5" />
                </button>
                <button
                  onClick={() => setWholeWord(!wholeWord)}
                  className={`p-1 rounded transition-colors ${
                    wholeWord ? "bg-blue-500/20" : "hover:bg-white/10"
                  }`}
                  title="Match Whole Word (Alt+W)"
                  style={{ color: wholeWord ? "#3b82f6" : "var(--ui-muted-foreground)" }}
                >
                  <WholeWord className="size-3.5" />
                </button>
                <button
                  onClick={() => setUseRegex(!useRegex)}
                  className={`p-1 rounded transition-colors ${
                    useRegex ? "bg-blue-500/20" : "hover:bg-white/10"
                  }`}
                  title="Use Regular Expression (Alt+R)"
                  style={{ color: useRegex ? "#3b82f6" : "var(--ui-muted-foreground)" }}
                >
                  <Regex className="size-3.5" />
                </button>
              </div>
            </div>

            {/* Directory Selector - Compact */}
            <div className="relative">
              <button
                onClick={() => setShowDirectoryPicker(!showDirectoryPicker)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs hover:bg-white/5 transition-colors border h-8"
                style={{
                  borderColor: "var(--ui-border)",
                  color: "var(--ui-muted-foreground)"
                }}
                title={selectedDirectory}
              >
                <FolderOpen className="size-3.5" />
                <span className="max-w-[120px] truncate">{getDirectoryName(selectedDirectory)}</span>
                <ChevronDown className="size-3" />
              </button>

              {/* Directory Picker Dropdown */}
              {showDirectoryPicker && (
                <div
                  className="absolute top-full mt-1 right-0 w-80 rounded border shadow-lg z-10 max-h-96 overflow-y-auto"
                  style={{
                    backgroundColor: "var(--ui-background)",
                    borderColor: "var(--ui-border)",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {activeProject && (
                    <>
                      {/* Root Directory */}
                      <button
                        onClick={() => {
                          setSelectedDirectory(activeProject.path);
                          setShowDirectoryPicker(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors text-left border-b"
                        style={{
                          color: "var(--ui-foreground)",
                          borderColor: "var(--ui-border)",
                          backgroundColor: selectedDirectory === activeProject.path ? "rgba(59, 130, 246, 0.1)" : undefined,
                        }}
                      >
                        <Folder className="size-4" style={{ color: "var(--ui-accent)" }} />
                        <span className="font-medium">{activeProject.name}</span>
                        <span className="text-xs ml-auto" style={{ color: "var(--ui-muted-foreground)" }}>
                          (Root)
                        </span>
                      </button>

                      {/* Subdirectories */}
                      <div className="py-1">
                        {renderDirectoryTree(directoryTree)}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <Button
              onClick={handleSearch}
              disabled={!searchQuery.trim() || isSearching}
              size="sm"
              className="h-8 px-3 text-xs"
            >
              {isSearching ? (
                <>
                  <RefreshCw className="size-3 mr-1.5 animate-spin" />
                  Searching
                </>
              ) : (
                <>
                  <Search className="size-3 mr-1.5" />
                  Search
                </>
              )}
            </Button>
          </div>

          {/* Replace Input Row - Collapsible */}
          {isReplaceExpanded && (
            <div className="flex items-center gap-2">
              <Input
                placeholder="Replace..."
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                className="flex-1 h-8 text-sm"
                style={{
                  backgroundColor: "var(--ui-background)",
                  borderColor: "var(--ui-border)",
                  color: "var(--ui-foreground)",
                }}
              />
              <Button
                onClick={handleReplaceAll}
                disabled={!results.length || !replaceText}
                variant="secondary"
                size="sm"
                className="h-8 px-3 text-xs"
              >
                Replace All
              </Button>
              <button
                onClick={() => setIsReplaceExpanded(false)}
                className="p-1 rounded hover:bg-white/10 transition-colors"
                style={{ color: "var(--ui-muted-foreground)" }}
                title="Hide Replace"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}

          {/* Toggle Replace Button */}
          {!isReplaceExpanded && (
            <button
              onClick={() => setIsReplaceExpanded(true)}
              className="flex items-center gap-1.5 text-xs px-2 py-1 rounded hover:bg-white/5 transition-colors"
              style={{ color: "var(--ui-muted-foreground)" }}
            >
              <ChevronRight className="size-3" />
              <Replace className="size-3" />
              <span>Show Replace</span>
            </button>
          )}
        </div>

        {/* Results List - Optimized */}
        <div className="flex-1 overflow-y-auto">
          {isSearching ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="size-5 animate-spin" style={{ color: "var(--ui-muted-foreground)" }} />
            </div>
          ) : results.length === 0 && searchQuery ? (
            <div className="text-center py-16 text-sm" style={{ color: "var(--ui-muted-foreground)" }}>
              No results found
            </div>
          ) : (
            <div>
              {results.map((result) => {
                const fileName = result.filePath.split("/").pop() || result.filePath;
                const relativePath = activeProject
                  ? result.filePath.replace(activeProject.path + "/", "")
                  : result.filePath;
                const isExpanded = expandedFiles.has(result.filePath);
                const iconConfig = getFileIcon(fileName, false);
                const IconComponent = iconConfig.icon;

                return (
                  <div
                    key={result.filePath}
                    className="border-b"
                    style={{ borderColor: "var(--ui-border)" }}
                  >
                    {/* File Header - Compact */}
                    <button
                      onClick={() => toggleFileExpansion(result.filePath)}
                      className="w-full flex items-center gap-2 px-4 py-2 hover:bg-white/5 transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown className="size-3.5 flex-shrink-0" style={{ color: "var(--ui-muted-foreground)" }} />
                      ) : (
                        <ChevronRight className="size-3.5 flex-shrink-0" style={{ color: "var(--ui-muted-foreground)" }} />
                      )}
                      <IconComponent
                        className="size-4 flex-shrink-0"
                        style={{ color: iconConfig.color }}
                      />
                      <div className="flex-1 min-w-0 text-left flex items-baseline gap-2">
                        <span className="font-medium text-sm truncate" style={{ color: "var(--ui-foreground)" }}>
                          {fileName}
                        </span>
                        <span className="text-xs truncate" style={{ color: "var(--ui-muted-foreground)" }}>
                          {relativePath}
                        </span>
                      </div>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{
                          backgroundColor: "var(--ui-accent)",
                          color: "var(--ui-accent-foreground)",
                          opacity: 0.6,
                        }}
                      >
                        {result.matches.length}
                      </span>
                    </button>

                    {/* Matches List - Compact */}
                    {isExpanded && (
                      <div>
                        {result.matches.map((match, index) => {
                          const matchKey = `${match.filePath}:${match.lineNumber}:${match.matchStart}`;
                          const isReplaced = replacedMatches.has(matchKey);

                          return (
                            <div
                              key={`${match.lineNumber}-${index}`}
                              className="flex items-center gap-2 px-4 py-1.5 hover:bg-white/5 transition-colors group"
                              style={{
                                paddingLeft: "3rem",
                              }}
                            >
                              <span
                                className="text-xs font-mono px-1.5 py-0.5 rounded flex-shrink-0 min-w-[3rem] text-right"
                                style={{
                                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                                  color: "var(--ui-muted-foreground)",
                                }}
                              >
                                {match.lineNumber}
                              </span>

                              <div
                                className="flex-1 min-w-0 cursor-pointer"
                                onClick={() => handleMatchClick(match)}
                              >
                                <code
                                  className="text-xs font-mono block truncate"
                                  style={{ color: "var(--ui-foreground)" }}
                                >
                                  {match.contextBefore}
                                  <span
                                    className="px-0.5 rounded font-semibold"
                                    style={{
                                      backgroundColor: isReplaced ? "#10b981" : "#fbbf24",
                                      color: "#000",
                                    }}
                                  >
                                    {match.lineContent.substring(match.matchStart, match.matchEnd)}
                                  </span>
                                  {match.contextAfter}
                                </code>
                              </div>

                              <div className="flex items-center gap-1 flex-shrink-0">
                                {isReplaceExpanded && !isReplaced && (
                                  <button
                                    onClick={() => handleReplaceOne(match)}
                                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 transition-all"
                                    style={{ color: "var(--ui-muted-foreground)" }}
                                    title="Replace"
                                  >
                                    <Replace className="size-3" />
                                  </button>
                                )}

                                {isReplaced && (
                                  <Check className="size-3.5 text-green-500" />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper function to search in files
async function searchInFiles(
  directory: string,
  query: string,
  caseSensitive: boolean,
  wholeWord: boolean,
  useRegex: boolean
): Promise<SearchResult[]> {
  const { invoke } = await import("@tauri-apps/api/core");

  const results = await invoke<SearchResult[]>("global_search", {
    directory,
    query,
    caseSensitive,
    wholeWord,
    useRegex,
  });

  return results;
}

// Helper function to replace in file
async function replaceInFile(
  filePath: string,
  lineNumber: number,
  matchStart: number,
  matchEnd: number,
  replaceText: string
): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");

  await invoke("replace_in_file", {
    filePath,
    lineNumber,
    matchStart,
    matchEnd,
    replaceText,
  });
}
