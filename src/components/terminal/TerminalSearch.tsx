import { useState, useEffect, useRef } from "react";
import { X, ChevronUp, ChevronDown } from "lucide-react";
import { SearchAddon } from "@xterm/addon-search";

interface TerminalSearchProps {
  searchAddon: SearchAddon | null;
  onClose: () => void;
}

export function TerminalSearch({
  searchAddon,
  onClose,
}: TerminalSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [currentMatch, setCurrentMatch] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) {
          handlePrevious();
        } else {
          handleNext();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [onClose, searchQuery, matchCase, useRegex]);

  // Perform search
  const performSearch = (direction: "next" | "previous" = "next") => {
    if (!searchAddon || !searchQuery) {
      setCurrentMatch(0);
      setTotalMatches(0);
      return;
    }

    const options = {
      caseSensitive: matchCase,
      regex: useRegex,
      wholeWord: false,
      decorations: {
        // 普通匹配：深色背景下使用深蓝色底色，保持文字清晰可读
        matchBackground: "rgba(100, 150, 255, 0.2)",
        matchBorder: "rgba(100, 150, 255, 0.4)",
        matchOverviewRuler: "rgba(100, 150, 255, 0.6)",
        // 当前匹配：使用橙色调，但降低透明度，确保文字可读
        activeMatchBackground: "rgba(255, 180, 100, 0.3)",
        activeMatchBorder: "rgba(255, 180, 100, 0.6)",
        activeMatchColorOverviewRuler: "rgba(255, 180, 100, 0.8)",
      },
    };

    if (direction === "next") {
      searchAddon.findNext(searchQuery, options);
    } else {
      searchAddon.findPrevious(searchQuery, options);
    }

    // Note: xterm.js SearchAddon doesn't provide match count API
    // We'll show a simplified indicator
    if (searchQuery) {
      setTotalMatches(-1); // -1 indicates "searching"
    } else {
      setTotalMatches(0);
    }
  };

  const handleNext = () => {
    performSearch("next");
    setCurrentMatch((prev) => prev + 1);
  };

  const handlePrevious = () => {
    performSearch("previous");
    setCurrentMatch((prev) => Math.max(1, prev - 1));
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentMatch(0);
    if (value) {
      performSearch("next");
    } else {
      searchAddon?.clearDecorations();
      setTotalMatches(0);
    }
  };

  const handleMatchCaseToggle = () => {
    setMatchCase(!matchCase);
    if (searchQuery) {
      performSearch("next");
    }
  };

  const handleRegexToggle = () => {
    setUseRegex(!useRegex);
    if (searchQuery) {
      performSearch("next");
    }
  };

  return (
    <div
      className="absolute top-2 right-2 z-50 flex items-center gap-2 backdrop-blur-sm border rounded-lg shadow-lg px-3 py-2"
      style={{
        backgroundColor: "var(--ui-background)",
        borderColor: "var(--ui-border)",
        color: "var(--ui-foreground)",
      }}
    >
      {/* Search input */}
      <input
        ref={inputRef}
        type="text"
        value={searchQuery}
        onChange={(e) => handleSearchChange(e.target.value)}
        placeholder="Find in terminal..."
        className="w-64 px-2 py-1 text-sm bg-transparent border rounded focus:outline-none focus:ring-1"
        style={{
          borderColor: "var(--ui-border)",
          color: "var(--ui-foreground)",
        }}
      />

      {/* Match count */}
      {searchQuery && (
        <span className="text-xs whitespace-nowrap" style={{ color: "var(--ui-foreground)", opacity: 0.7 }}>
          {totalMatches === -1 ? "Searching..." : totalMatches === 0 ? "No matches" : `${currentMatch} of many`}
        </span>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={handlePrevious}
          disabled={!searchQuery}
          className="p-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: "transparent",
            color: "var(--ui-foreground)",
          }}
          onMouseEnter={(e) => {
            if (!e.currentTarget.disabled) {
              e.currentTarget.style.backgroundColor = "var(--ui-tab-background-active)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
          title="Previous match (Shift+Enter)"
        >
          <ChevronUp className="size-4" />
        </button>
        <button
          onClick={handleNext}
          disabled={!searchQuery}
          className="p-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: "transparent",
            color: "var(--ui-foreground)",
          }}
          onMouseEnter={(e) => {
            if (!e.currentTarget.disabled) {
              e.currentTarget.style.backgroundColor = "var(--ui-tab-background-active)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
          title="Next match (Enter)"
        >
          <ChevronDown className="size-4" />
        </button>
      </div>

      {/* Toggles */}
      <div className="flex items-center gap-1 border-l pl-2" style={{ borderColor: "var(--ui-border)" }}>
        <button
          onClick={handleMatchCaseToggle}
          className="px-2 py-1 text-xs rounded"
          style={{
            backgroundColor: matchCase ? "var(--ui-border-active)" : "transparent",
            color: "var(--ui-foreground)",
          }}
          onMouseEnter={(e) => {
            if (!matchCase) {
              e.currentTarget.style.backgroundColor = "var(--ui-tab-background-active)";
            }
          }}
          onMouseLeave={(e) => {
            if (!matchCase) {
              e.currentTarget.style.backgroundColor = "transparent";
            }
          }}
          title="Match case"
        >
          Aa
        </button>
        <button
          onClick={handleRegexToggle}
          className="px-2 py-1 text-xs rounded font-mono"
          style={{
            backgroundColor: useRegex ? "var(--ui-border-active)" : "transparent",
            color: "var(--ui-foreground)",
          }}
          onMouseEnter={(e) => {
            if (!useRegex) {
              e.currentTarget.style.backgroundColor = "var(--ui-tab-background-active)";
            }
          }}
          onMouseLeave={(e) => {
            if (!useRegex) {
              e.currentTarget.style.backgroundColor = "transparent";
            }
          }}
          title="Use regular expression"
        >
          .*
        </button>
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="p-1 rounded"
        style={{
          backgroundColor: "transparent",
          color: "var(--ui-foreground)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "var(--ui-tab-background-active)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
        }}
        title="Close (Escape)"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
