import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import CodeMirror, { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { EditorView, keymap } from "@codemirror/view";
import { EditorState, Extension } from "@codemirror/state";
import { search, highlightSelectionMatches, SearchQuery, setSearchQuery, findNext, findPrevious, getSearchQuery } from "@codemirror/search";
import { oneDark } from "@codemirror/theme-one-dark";
import { loadLanguage } from "@/lib/editor-languages";
import { createRefinexTheme } from "@/lib/editor-theme";

export interface SearchOptions {
  caseSensitive?: boolean;
  wholeWord?: boolean;
  regexp?: boolean;
}

export interface SearchState {
  matches: number;
  currentIndex: number;
}

export interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language: string;
  readOnly?: boolean;
  onSave?: () => void;
  className?: string;
}

export interface CodeEditorRef {
  search: (query: string, options: SearchOptions) => void;
  findNext: () => void;
  findPrevious: () => void;
  getSearchState: () => SearchState;
  focus: () => void;
}

export const CodeEditor = forwardRef<CodeEditorRef, CodeEditorProps>(
  ({ value, onChange, language, readOnly = false, onSave, className }, ref) => {
    const editorRef = useRef<ReactCodeMirrorRef>(null);
    const [languageExtension, setLanguageExtension] = useState<Extension | null>(null);

    // Load language extension
    useEffect(() => {
      if (!language) {
        setLanguageExtension(null);
        return;
      }

      let cancelled = false;

      loadLanguage(language).then((lang) => {
        if (!cancelled) {
          console.log(`Loaded language for ${language}:`, lang ? 'success' : 'no language support');
          setLanguageExtension(lang);
        }
      }).catch((err) => {
        console.error(`Failed to load language for ${language}:`, err);
      });

      return () => {
        cancelled = true;
      };
    }, [language]);

    // Build extensions
    const extensions = useMemo(() => {
      const exts: Extension[] = [
        oneDark,
        createRefinexTheme(),
        search({
          top: true,
        }),
        highlightSelectionMatches(),
        EditorView.lineWrapping,
      ];

      if (languageExtension) {
        exts.push(languageExtension);
      }

      if (readOnly) {
        exts.push(EditorState.readOnly.of(true));
      }

      // Add Cmd+S / Ctrl+S keybinding
      if (onSave && !readOnly) {
        exts.push(
          keymap.of([
            {
              key: "Mod-s",
              run: () => {
                onSave();
                return true;
              },
            },
          ])
        );
      }

      return exts;
    }, [languageExtension, readOnly, onSave]);

    // Expose API via ref
    useImperativeHandle(ref, () => ({
      search: (query: string, options: SearchOptions) => {
        const view = editorRef.current?.view;
        if (!view) return;

        const searchQuery = new SearchQuery({
          search: query,
          caseSensitive: options.caseSensitive || false,
          wholeWord: options.wholeWord || false,
          regexp: options.regexp || false,
        });

        view.dispatch({
          effects: setSearchQuery.of(searchQuery),
        });
      },

      findNext: () => {
        const view = editorRef.current?.view;
        if (view) {
          findNext(view);
        }
      },

      findPrevious: () => {
        const view = editorRef.current?.view;
        if (view) {
          findPrevious(view);
        }
      },

      getSearchState: (): SearchState => {
        const view = editorRef.current?.view;
        if (!view) return { matches: 0, currentIndex: 0 };

        const query = getSearchQuery(view.state);
        if (!query || !query.search) {
          return { matches: 0, currentIndex: 0 };
        }

        // Count matches manually
        let matches = 0;
        let currentIndex = 0;
        const cursor = query.getCursor(view.state.doc);
        const currentPos = view.state.selection.main.head;

        let result = cursor.next();
        while (!result.done) {
          matches++;
          if (result.value.from <= currentPos && result.value.to >= currentPos) {
            currentIndex = matches;
          }
          result = cursor.next();
        }

        return { matches, currentIndex };
      },

      focus: () => {
        editorRef.current?.view?.focus();
      },
    }));

    return (
      <CodeMirror
        ref={editorRef}
        value={value}
        {...(onChange && { onChange })}
        extensions={extensions}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: true,
          highlightActiveLine: true,
          foldGutter: true,
          dropCursor: true,
          allowMultipleSelections: true,
          indentOnInput: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: false,
          rectangularSelection: true,
          crosshairCursor: true,
          highlightSelectionMatches: false, // We add this manually
          closeBracketsKeymap: true,
          searchKeymap: false, // We handle search externally
          foldKeymap: true,
          completionKeymap: false,
          lintKeymap: false,
        }}
        className={className}
        style={{ height: "100%", fontSize: "13px" }}
      />
    );
  }
);

CodeEditor.displayName = "CodeEditor";
