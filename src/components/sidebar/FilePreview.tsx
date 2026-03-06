import { useState, useEffect, useRef, useCallback } from "react";
import { FileText, X, ChevronUp, ChevronDown, ExternalLink, FileEdit, Columns, Eye } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { useFileEditorStore } from "@/stores/file-editor-store";
import { useSettingsStore } from "@/stores/settings-store";
import { CodeEditor, CodeEditorRef } from "@/components/editor/CodeEditor";
import { MarkdownPreview, MarkdownPreviewRef } from "@/components/editor/MarkdownPreview";

interface FilePreviewProps {
  filePath: string;
  fileName: string;
  tabId: string;
  showSearch: boolean;
  onSearchToggle: () => void;
}


/**
 * Check if file is an image
 */
function isImageFile(fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase();
  return ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico"].includes(ext || "");
}

/**
 * Check if file is a Markdown file
 */
function isMarkdownFile(fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase();
  return ext === "md" || ext === "markdown";
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


type PreviewMode = 'editor' | 'split' | 'preview';

export function FilePreview({ filePath, fileName, tabId, showSearch, onSearchToggle }: FilePreviewProps) {
  const [content, setContent] = useState<string>("");
  const [editedContent, setEditedContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [fileSize, setFileSize] = useState<number>(0);
  const [modified, setModified] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [searchState, setSearchState] = useState<{ matches: number; currentIndex: number }>({ matches: 0, currentIndex: 0 });
  const [previewMode, setPreviewMode] = useState<PreviewMode>('editor');
  const [splitRatio, setSplitRatio] = useState(50);
  const [isResizing, setIsResizing] = useState(false);
  const { updateTabDirty, updateTabContent } = useFileEditorStore();
  const { autoSave } = useSettingsStore();
  const editorRef = useRef<CodeEditorRef>(null);
  const previewRef = useRef<MarkdownPreviewRef>(null);
  const autoSaveTimeoutRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollSyncTimeoutRef = useRef<number | null>(null);
  const isScrollSyncingRef = useRef(false);

  const isImage = isImageFile(fileName);
  const isMarkdown = isMarkdownFile(fileName);

  // Load file content
  useEffect(() => {
    loadFile();
  }, [filePath]);

  // Auto-detect markdown files and set default mode to split
  useEffect(() => {
    if (isMarkdown) {
      setPreviewMode('split');
    } else {
      setPreviewMode('editor');
    }
  }, [isMarkdown]);

  // Handle editor scroll -> preview scroll sync
  const handleEditorScroll = useCallback((scrollPercentage: number) => {
    if (isScrollSyncingRef.current || !previewRef.current) return;

    isScrollSyncingRef.current = true;

    // Use requestAnimationFrame for smooth scrolling
    requestAnimationFrame(() => {
      if (previewRef.current) {
        previewRef.current.scrollToPercentage(scrollPercentage);
      }
    });

    if (scrollSyncTimeoutRef.current) {
      clearTimeout(scrollSyncTimeoutRef.current);
    }
    scrollSyncTimeoutRef.current = window.setTimeout(() => {
      isScrollSyncingRef.current = false;
    }, 150);
  }, []);

  // Handle preview scroll -> editor scroll sync
  const handlePreviewScroll = useCallback((scrollPercentage: number) => {
    if (isScrollSyncingRef.current || !editorRef.current?.scrollToPercentage) return;

    isScrollSyncingRef.current = true;

    // Use requestAnimationFrame for smooth scrolling
    requestAnimationFrame(() => {
      if (editorRef.current?.scrollToPercentage) {
        editorRef.current.scrollToPercentage(scrollPercentage);
      }
    });

    if (scrollSyncTimeoutRef.current) {
      clearTimeout(scrollSyncTimeoutRef.current);
    }
    scrollSyncTimeoutRef.current = window.setTimeout(() => {
      isScrollSyncingRef.current = false;
    }, 150);
  }, []);

  // Update dirty state when content changes (debounced to avoid excessive updates)
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const isDirty = editedContent !== content;
      updateTabDirty(tabId, isDirty);
      updateTabContent(tabId, editedContent);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [editedContent, content, tabId, updateTabDirty, updateTabContent]);

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
      updateTabContent(tabId, fileContent);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = useCallback(async (isAutoSave = false) => {
    if (isSaving || editedContent === content) return;

    setIsSaving(true);

    try {
      await invoke("write_file", { path: filePath, content: editedContent });
      setContent(editedContent);
      updateTabDirty(tabId, false);

      // Show success toast for manual saves
      if (!isAutoSave) {
        toast.success("File saved", {
          description: fileName,
          duration: 2000,
        });
      }
    } catch (err) {
      const errorMessage = `Failed to save file: ${err}`;
      console.error(errorMessage);

      // Show error toast
      toast.error("Save failed", {
        description: errorMessage,
        duration: 4000,
      });
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, editedContent, content, filePath, tabId, fileName, updateTabDirty]);

  const handleContentChange = useCallback((newContent: string) => {
    // Use startTransition to mark this as a low-priority update
    setEditedContent(newContent);

    // Clear existing auto-save timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set up new auto-save timeout if enabled (increased delay to reduce I/O)
    if (autoSave.enabled && autoSave.afterDelay > 0) {
      autoSaveTimeoutRef.current = window.setTimeout(() => {
        handleSave(true);
      }, Math.max(autoSave.afterDelay, 2000)); // Minimum 2 seconds to avoid frequent saves
    }
  }, [autoSave.enabled, autoSave.afterDelay, handleSave]);

  // Auto-save on tab switch (when this component unmounts or tab becomes inactive)
  useEffect(() => {
    return () => {
      // Clear auto-save timeout
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }

      // Save if there are unsaved changes when switching tabs (if enabled)
      if (autoSave.enabled && autoSave.onTabSwitch && editedContent !== content && !isImage) {
        handleSave(true);
      }
    };
  }, [editedContent, content, isImage, autoSave.enabled, autoSave.onTabSwitch, handleSave]);

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
      setSearchState({ matches: 0, currentIndex: 0 });
      return;
    }

    editorRef.current.search(searchQuery, {
      caseSensitive,
      wholeWord,
    });

    // Update search state after a short delay to allow CodeMirror to process
    setTimeout(() => {
      if (editorRef.current) {
        setSearchState(editorRef.current.getSearchState());
      }
    }, 50);
  }, [searchQuery, caseSensitive, wholeWord, isImage]);

  const handlePrevMatch = () => {
    editorRef.current?.findPrevious();
    // Update search state after navigation
    setTimeout(() => {
      if (editorRef.current) {
        setSearchState(editorRef.current.getSearchState());
      }
    }, 50);
  };

  const handleNextMatch = () => {
    editorRef.current?.findNext();
    // Update search state after navigation
    setTimeout(() => {
      if (editorRef.current) {
        setSearchState(editorRef.current.getSearchState());
      }
    }, 50);
  };

  // Handle split view resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newRatio = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      setSplitRatio(Math.max(30, Math.min(70, newRatio)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Handle Cmd/Ctrl + F to search and Escape to close search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if the editor is focused by checking if the event target is within the editor
      const target = e.target as HTMLElement;
      const isEditorFocused = target.closest('.cm-editor') !== null;

      if (!isEditorFocused) return;

      const modifier = e.metaKey || e.ctrlKey;

      // Stop propagation for all editor shortcuts to prevent terminal from handling them
      // This includes: Cmd/Ctrl + V (paste), Cmd/Ctrl + C (copy), Cmd/Ctrl + X (cut),
      // Cmd/Ctrl + A (select all), Cmd/Ctrl + Z (undo), Cmd/Ctrl + Y (redo), etc.
      if (modifier && ['v', 'c', 'x', 'a', 'z', 'y', 's'].includes(e.key.toLowerCase())) {
        e.stopPropagation();
        // Let CodeMirror handle these shortcuts natively
        return;
      }

      // Cmd/Ctrl + F: Open search
      if (modifier && e.key === "f" && !isImage && !error) {
        e.preventDefault();
        e.stopPropagation();
        onSearchToggle();
        return;
      }

      // Escape: Close search
      if (e.key === "Escape" && showSearch) {
        e.preventDefault();
        e.stopPropagation();
        onSearchToggle();
        return;
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [showSearch, isImage, error, onSearchToggle]);

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "var(--ui-background)" }}>
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
            onClick={() => onSearchToggle()}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            style={{ color: "var(--ui-foreground)" }}
            title="Close search"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Toolbar for Markdown files */}
      {isMarkdown && !loading && !error && (
        <div
          className="flex items-center justify-end gap-1 px-4 py-2 border-b"
          style={{ borderColor: "var(--ui-border)", backgroundColor: "var(--ui-background)" }}
        >
          <button
            onClick={() => setPreviewMode('editor')}
            className={`p-1 rounded hover:bg-white/10 transition-colors ${
              previewMode === 'editor' ? 'bg-white/10' : ''
            }`}
            style={{ color: "var(--ui-foreground)" }}
            title="Editor Only"
          >
            <FileEdit className="size-4" />
          </button>
          <button
            onClick={() => setPreviewMode('split')}
            className={`p-1 rounded hover:bg-white/10 transition-colors ${
              previewMode === 'split' ? 'bg-white/10' : ''
            }`}
            style={{ color: "var(--ui-foreground)" }}
            title="Split View"
          >
            <Columns className="size-4" />
          </button>
          <button
            onClick={() => setPreviewMode('preview')}
            className={`p-1 rounded hover:bg-white/10 transition-colors ${
              previewMode === 'preview' ? 'bg-white/10' : ''
            }`}
            style={{ color: "var(--ui-foreground)" }}
            title="Preview Only"
          >
            <Eye className="size-4" />
          </button>
        </div>
      )}

      {/* Content */}
      <div ref={containerRef} className="flex-1 overflow-hidden">
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
        ) : isMarkdown ? (
          <>
            {previewMode === 'editor' && (
              <CodeEditor
                ref={editorRef}
                value={editedContent}
                {...{ onChange: handleContentChange }}
                language={fileName}
                readOnly={false}
                onSave={() => handleSave(false)}
                className="h-full"
              />
            )}
            {previewMode === 'split' && (
              <div className="flex h-full">
                <div style={{ width: `${splitRatio}%`, height: '100%', overflow: 'hidden' }}>
                  <CodeEditor
                    ref={editorRef}
                    value={editedContent}
                    {...{ onChange: handleContentChange }}
                    language={fileName}
                    readOnly={false}
                    onSave={() => handleSave(false)}
                    onScroll={handleEditorScroll}
                    className="h-full"
                  />
                </div>
                <div
                  className="w-1 cursor-col-resize hover:bg-blue-500 transition-colors"
                  style={{ backgroundColor: isResizing ? 'rgba(59, 130, 246, 0.5)' : 'var(--ui-border)' }}
                  onMouseDown={() => setIsResizing(true)}
                />
                <div style={{ width: `${100 - splitRatio}%`, height: '100%', overflow: 'hidden' }}>
                  <MarkdownPreview
                    ref={previewRef}
                    content={editedContent}
                    onScroll={handlePreviewScroll}
                    className="h-full"
                  />
                </div>
              </div>
            )}
            {previewMode === 'preview' && (
              <MarkdownPreview
                ref={previewRef}
                content={editedContent}
                className="h-full"
              />
            )}
          </>
        ) : (
          <CodeEditor
            ref={editorRef}
            value={editedContent}
            {...{ onChange: handleContentChange }}
            language={fileName}
            readOnly={false}
            onSave={() => handleSave(false)}
            className="h-full"
          />
        )}
      </div>
    </div>
  );
}
