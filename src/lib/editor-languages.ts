import { LanguageSupport } from "@codemirror/language";

/**
 * Maps file extensions to CodeMirror language loaders.
 * Common languages are eagerly loaded, others are lazy-loaded.
 */
export async function loadLanguage(fileName: string): Promise<LanguageSupport | null> {
  const ext = fileName.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "js":
    case "mjs":
    case "cjs":
      return (await import("@codemirror/lang-javascript")).javascript();

    case "jsx":
      return (await import("@codemirror/lang-javascript")).javascript({ jsx: true });

    case "ts":
    case "mts":
    case "cts":
      return (await import("@codemirror/lang-javascript")).javascript({ typescript: true });

    case "tsx":
      return (await import("@codemirror/lang-javascript")).javascript({ jsx: true, typescript: true });

    case "py":
    case "pyw":
      return (await import("@codemirror/lang-python")).python();

    case "rs":
      return (await import("@codemirror/lang-rust")).rust();

    case "go":
      return (await import("@codemirror/lang-go")).go();

    case "html":
    case "htm":
      return (await import("@codemirror/lang-html")).html();

    case "css":
    case "scss":
    case "sass":
    case "less":
      return (await import("@codemirror/lang-css")).css();

    case "json":
    case "jsonc":
      return (await import("@codemirror/lang-json")).json();

    case "md":
    case "markdown":
    case "mdown":
    case "mkd":
      return (await import("@codemirror/lang-markdown")).markdown();

    case "java":
      return (await import("@codemirror/lang-java")).java();

    case "xml":
    case "svg":
      return (await import("@codemirror/lang-xml")).xml();

    case "yaml":
    case "yml":
      return (await import("@codemirror/lang-yaml")).yaml();

    default:
      return null; // Plain text fallback
  }
}

/**
 * Detects language from file name for display purposes.
 */
export function detectLanguageName(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();

  const languageMap: Record<string, string> = {
    js: "JavaScript",
    mjs: "JavaScript",
    cjs: "JavaScript",
    jsx: "JavaScript (JSX)",
    ts: "TypeScript",
    mts: "TypeScript",
    cts: "TypeScript",
    tsx: "TypeScript (TSX)",
    py: "Python",
    pyw: "Python",
    rs: "Rust",
    go: "Go",
    html: "HTML",
    htm: "HTML",
    css: "CSS",
    scss: "SCSS",
    sass: "Sass",
    less: "Less",
    json: "JSON",
    jsonc: "JSON",
    md: "Markdown",
    markdown: "Markdown",
    mdown: "Markdown",
    mkd: "Markdown",
    java: "Java",
    xml: "XML",
    svg: "SVG",
    yaml: "YAML",
    yml: "YAML",
  };

  return languageMap[ext || ""] || "Plain Text";
}

