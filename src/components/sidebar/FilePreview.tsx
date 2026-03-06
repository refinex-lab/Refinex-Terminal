import { useState, useEffect, useRef } from "react";
import { Edit, Save, ExternalLink, FileText, Search, X, ChevronUp, ChevronDown } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useFileEditorStore } from "@/stores/file-editor-store";
import { CodeEditor, CodeEditorRef } from "@/components/editor/CodeEditor";

interface FilePreviewProps {
  filePath: string;
  fileName: string;
  tabId: string;
}


/**
 * Check if file is an image
 */
function isImageFile(fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase();
  return ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico"].includes(ext || "");
}

/**
 * Format file size
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Format timestamp
 */
function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}


export function FilePreview({ filePath, fileName, tabId }: FilePreviewProps) {
  const [content, setContent] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [fileSize, setFileSize] = useState<number>(0);
  const [modified, setModified] = useState<number>(0);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const { updateTabDirty } = useFileEditorStore();
  const editorRef = useRef<CodeEditorRef>(null);

  const isImage = isImageFile(fileName);

  // Load file content
  useEffect(() => {
    loadFile();
  }, [filePath]);

  // Update dirty state when content changes
  useEffect(() => {
    if (isEditing) {
      const isDirty = editedContent !== content;
      updateTabDirty(tabId, isDirty);
    }
  }, [editedContent, content, isEditing, tabId, updateTabDirty]);

  const loadFile = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get file metadata first
      const metadata = await invoke<{ size: number; modified: number }>("get_file_metadata", { path: filePath });
      setFileSize(metadata.size);
      setModified(metadata.modified);

      // For images, just set the path
      if (isImage) {
        setContent(filePath);
        setLoading(false);
        return;
      }

      // For text files, read content
      const fileContent = await invoke<string>("read_file", { path: filePath });
      setContent(fileContent);
      setEditedContent(fileContent);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditedContent(content);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await invoke("write_file", { path: filePath, content: editedContent });
      setContent(editedContent);
      setIsEditing(false);
      updateTabDirty(tabId, false);
    } catch (err) {
      alert(`Failed to save file: ${err}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedContent(content);
    updateTabDirty(tabId, false);
  };

  const handleOpenExternal = async () => {
    try {
      await invoke("reveal_in_finder", { path: filePath });
    } catch (err) {
      console.error("Failed to open file:", err);
    }
  };

  // Search logic - wire to CodeMirror
  useEffect(() => {
    if (!searchQuery || isImage || !editorRef.current) {
      return;
    }

    editorRef.current.search(searchQuery, {
      caseSensitive,
      wholeWord,
    });
  }, [searchQuery, caseSensitive, wholeWord, isImage]);

  const handlePrevMatch = () => {
    editorRef.current?.findPrevious();
  };

  const handleNextMatch = () => {
    editorRef.current?.findNext();
  };

  // Get search state for display
  const searchState = editorRef.current?.getSearchState() || { matches: 0, currentIndex: 0 };

  // Handle Cmd/Ctrl + F to search and Escape to close search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f" && !isImage && !error) {
        e.preventDefault();
        setShowSearch((prev) => !prev);
      }
      if (e.key === "Escape" && showSearch) {
        e.preventDefault();
        setShowSearch(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showSearch, isImage, error]);

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "var(--ui-background)" }}>
      {/* Toolbar */}
      <div
        className="flex items-center justify-end gap-2 px-4 py-2 border-b"
        style={{ borderColor: "var(--ui-border)" }}
      >
        {!isImage && !error && !isEditing && (
          <button
            onClick={handleEdit}
            className="flex items-center gap-1.5 px-2 py-1 text-xs rounded hover:bg-white/10 transition-colors"
            style={{ color: "var(--ui-foreground)" }}
          >
            <Edit className="size-3.5" />
            Edit
          </button>
        )}
        {isEditing && (
          <>
            <button
              onClick={handleCancel}
              className="px-2 py-1 text-xs rounded hover:bg-white/10 transition-colors"
              style={{ color: "var(--ui-foreground)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors"
              style={{
                backgroundColor: "var(--ui-button-background)",
                color: "var(--ui-foreground)",
                opacity: isSaving ? 0.5 : 1,
              }}
            >
              <Save className="size-3.5" />
              {isSaving ? "Saving..." : "Save"}
            </button>
          </>
        )}
        {!isImage && !error && (
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            style={{ color: "var(--ui-foreground)" }}
            title="Search (Cmd/Ctrl+F)"
          >
            <Search className="size-4" />
          </button>
        )}
        <button
          onClick={handleOpenExternal}
          className="p-1 rounded hover:bg-white/10 transition-colors"
          style={{ color: "var(--ui-foreground)" }}
          title="Open with system editor"
        >
          <ExternalLink className="size-4" />
        </button>
      </div>

      {/* Search Panel */}
      {showSearch && !isImage && !error && (
        <div
          className="flex items-center gap-2 px-4 py-2 border-b"
          style={{ borderColor: "var(--ui-border)", backgroundColor: "var(--ui-background)" }}
        >
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="flex-1 px-2 py-1 text-xs rounded border focus:outline-none focus:ring-1 focus:ring-blue-500"
            style={{
              backgroundColor: "var(--ui-background)",
              color: "var(--ui-foreground)",
              borderColor: "var(--ui-border)",
            }}
            autoFocus
          />
          <button
            onClick={() => setCaseSensitive(!caseSensitive)}
            className="px-2 py-1 text-xs rounded hover:bg-white/10 transition-colors"
            style={{
              color: "var(--ui-foreground)",
              backgroundColor: caseSensitive ? "var(--ui-button-background)" : "transparent",
            }}
            title="Case sensitive"
          >
            Aa
          </button>
          <button
            onClick={() => setWholeWord(!wholeWord)}
            className="px-2 py-1 text-xs rounded hover:bg-white/10 transition-colors"
            style={{
              color: "var(--ui-foreground)",
              backgroundColor: wholeWord ? "var(--ui-button-background)" : "transparent",
            }}
            title="Match whole word"
          >
            Ab
          </button>
          <span className="text-xs" style={{ color: "var(--ui-foreground)", opacity: 0.7 }}>
            {searchState.matches > 0 ? `${searchState.currentIndex} of ${searchState.matches}` : "No results"}
          </span>
          <button
            onClick={handlePrevMatch}
            disabled={searchState.matches === 0}
            className="p-1 rounded hover:bg-white/10 transition-colors disabled:opacity-30"
            style={{ color: "var(--ui-foreground)" }}
            title="Previous match"
          >
            <ChevronUp className="size-4" />
          </button>
          <button
            onClick={handleNextMatch}
            disabled={searchState.matches === 0}
            className="p-1 rounded hover:bg-white/10 transition-colors disabled:opacity-30"
            style={{ color: "var(--ui-foreground)" }}
            title="Next match"
          >
            <ChevronDown className="size-4" />
          </button>
          <button
            onClick={() => setShowSearch(false)}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            style={{ color: "var(--ui-foreground)" }}
            title="Close search"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-sm" style={{ color: "var(--ui-foreground)", opacity: 0.7 }}>
              Loading...
            </span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full px-4 text-center">
            <FileText
              className="size-12 mb-3"
              style={{ color: "var(--ui-foreground)", opacity: 0.3 }}
            />
            <p className="text-sm mb-2" style={{ color: "var(--ui-foreground)", opacity: 0.7 }}>
              {error}
            </p>
            <div className="mt-4 text-xs" style={{ color: "var(--ui-foreground)", opacity: 0.5 }}>
              <p>Size: {formatFileSize(fileSize)}</p>
              {modified > 0 && <p>Modified: {formatDate(modified)}</p>}
            </div>
            <button
              onClick={handleOpenExternal}
              className="mt-4 flex items-center gap-2 px-3 py-1.5 text-xs rounded"
              style={{
                backgroundColor: "var(--ui-button-background)",
                color: "var(--ui-foreground)",
              }}
            >
              <ExternalLink className="size-3.5" />
              Open with System Editor
            </button>
          </div>
        ) : isImage ? (
          <div className="flex items-center justify-center h-full p-4">
            <img
              src={`file://${content}`}
              alt={fileName}
              className="max-w-full max-h-full object-contain"
              style={{ borderRadius: "4px" }}
            />
          </div>
        ) : (
          <CodeEditor
            ref={editorRef}
            value={isEditing ? editedContent : content}
            {...(isEditing && { onChange: (val: string) => setEditedContent(val) })}
            language={fileName}
            readOnly={!isEditing}
            onSave={handleSave}
            className="h-full"
          />
        )}
      </div>
    </div>
  );
}
