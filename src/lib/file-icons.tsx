import { type LucideIcon } from "lucide-react";
import {
  SiJavascript,
  SiTypescript,
  SiReact,
  SiPython,
  SiRust,
  SiGo,
  SiCplusplus,
  SiC,
  SiHtml5,
  SiCss,
  SiJson,
  SiMarkdown,
  SiYaml,
  SiToml,
  SiDocker,
  SiGit,
  SiNodedotjs,
  SiVuedotjs,
  SiSvelte,
  SiPhp,
  SiRuby,
  SiSwift,
  SiKotlin,
  SiShell,
  SiGraphql,
  SiSass,
  SiLess,
  SiWebpack,
  SiVite,
  SiEslint,
  SiPrettier,
  SiJest,
  SiVitest,
  SiTailwindcss,
  SiPostcss,
  SiNpm,
  SiPnpm,
  SiYarn,
  SiGradle,
  SiSqlite,
  SiPostgresql,
} from "react-icons/si";
import {
  VscJson,
  VscCode,
  VscFileCode,
  VscFileBinary,
  VscFile,
} from "react-icons/vsc";
import { FaFileAlt, FaFileImage, FaFileArchive, FaFilePdf, FaFileVideo, FaFileAudio, FaJava } from "react-icons/fa";

/**
 * Icon type - can be either Lucide or React Icon
 */
export type FileIconType = LucideIcon | React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

/**
 * File icon configuration
 */
interface FileIconConfig {
  icon: FileIconType;
  color: string;
}

/**
 * High-performance file extension to icon mapping using Map for O(1) lookup
 * Organized by category for maintainability
 */
const FILE_ICON_MAP = new Map<string, FileIconConfig>([
  // JavaScript/TypeScript ecosystem
  ["js", { icon: SiJavascript, color: "#F7DF1E" }],
  ["jsx", { icon: SiReact, color: "#61DAFB" }],
  ["ts", { icon: SiTypescript, color: "#3178C6" }],
  ["tsx", { icon: SiReact, color: "#61DAFB" }],
  ["mjs", { icon: SiJavascript, color: "#F7DF1E" }],
  ["cjs", { icon: SiJavascript, color: "#F7DF1E" }],

  // Web technologies
  ["html", { icon: SiHtml5, color: "#E34F26" }],
  ["htm", { icon: SiHtml5, color: "#E34F26" }],
  ["css", { icon: SiCss, color: "#1572B6" }],
  ["scss", { icon: SiSass, color: "#CC6699" }],
  ["sass", { icon: SiSass, color: "#CC6699" }],
  ["less", { icon: SiLess, color: "#1D365D" }],

  // Frontend frameworks
  ["vue", { icon: SiVuedotjs, color: "#4FC08D" }],
  ["svelte", { icon: SiSvelte, color: "#FF3E00" }],

  // Backend languages
  ["py", { icon: SiPython, color: "#3776AB" }],
  ["java", { icon: FaJava, color: "#007396" }],
  ["rs", { icon: SiRust, color: "#CE422B" }],
  ["go", { icon: SiGo, color: "#00ADD8" }],
  ["cpp", { icon: SiCplusplus, color: "#00599C" }],
  ["cc", { icon: SiCplusplus, color: "#00599C" }],
  ["cxx", { icon: SiCplusplus, color: "#00599C" }],
  ["c", { icon: SiC, color: "#A8B9CC" }],
  ["h", { icon: SiC, color: "#A8B9CC" }],
  ["hpp", { icon: SiCplusplus, color: "#00599C" }],
  ["php", { icon: SiPhp, color: "#777BB4" }],
  ["rb", { icon: SiRuby, color: "#CC342D" }],
  ["swift", { icon: SiSwift, color: "#FA7343" }],
  ["kt", { icon: SiKotlin, color: "#7F52FF" }],
  ["cs", { icon: VscFileCode, color: "#239120" }],

  // Shell scripts
  ["sh", { icon: SiShell, color: "#4EAA25" }],
  ["bash", { icon: SiShell, color: "#4EAA25" }],
  ["zsh", { icon: SiShell, color: "#4EAA25" }],
  ["fish", { icon: SiShell, color: "#4EAA25" }],

  // Data formats
  ["json", { icon: SiJson, color: "#F7DF1E" }],
  ["jsonc", { icon: VscJson, color: "#F7DF1E" }],
  ["json5", { icon: VscJson, color: "#F7DF1E" }],
  ["yaml", { icon: SiYaml, color: "#CB171E" }],
  ["yml", { icon: SiYaml, color: "#CB171E" }],
  ["toml", { icon: SiToml, color: "#9C4121" }],
  ["xml", { icon: VscCode, color: "#E34F26" }],
  ["csv", { icon: FaFileAlt, color: "#10B981" }],

  // Documentation
  ["md", { icon: SiMarkdown, color: "#FFFFFF" }],
  ["mdx", { icon: SiMarkdown, color: "#FFFFFF" }],
  ["txt", { icon: FaFileAlt, color: "#9CA3AF" }],
  ["pdf", { icon: FaFilePdf, color: "#DC2626" }],

  // Configuration files
  ["env", { icon: VscFileCode, color: "#EAB308" }],
  ["gitignore", { icon: SiGit, color: "#F05032" }],
  ["gitattributes", { icon: SiGit, color: "#F05032" }],
  ["editorconfig", { icon: VscCode, color: "#9CA3AF" }],
  ["dockerignore", { icon: SiDocker, color: "#2496ED" }],
  ["eslintrc", { icon: SiEslint, color: "#4B32C3" }],
  ["prettierrc", { icon: SiPrettier, color: "#F7B93E" }],

  // Build tools & package managers
  ["dockerfile", { icon: SiDocker, color: "#2496ED" }],
  ["webpack", { icon: SiWebpack, color: "#8DD6F9" }],
  ["vite", { icon: SiVite, color: "#646CFF" }],
  ["rollup", { icon: VscFileCode, color: "#EC4A3F" }],

  // Package files
  ["package", { icon: SiNodedotjs, color: "#339933" }],
  ["lock", { icon: VscFileBinary, color: "#9CA3AF" }],

  // GraphQL
  ["graphql", { icon: SiGraphql, color: "#E10098" }],
  ["gql", { icon: SiGraphql, color: "#E10098" }],

  // Images
  ["png", { icon: FaFileImage, color: "#10B981" }],
  ["jpg", { icon: FaFileImage, color: "#10B981" }],
  ["jpeg", { icon: FaFileImage, color: "#10B981" }],
  ["gif", { icon: FaFileImage, color: "#10B981" }],
  ["svg", { icon: FaFileImage, color: "#F59E0B" }],
  ["webp", { icon: FaFileImage, color: "#10B981" }],
  ["ico", { icon: FaFileImage, color: "#10B981" }],
  ["bmp", { icon: FaFileImage, color: "#10B981" }],

  // Media
  ["mp4", { icon: FaFileVideo, color: "#8B5CF6" }],
  ["mov", { icon: FaFileVideo, color: "#8B5CF6" }],
  ["avi", { icon: FaFileVideo, color: "#8B5CF6" }],
  ["mkv", { icon: FaFileVideo, color: "#8B5CF6" }],
  ["mp3", { icon: FaFileAudio, color: "#EC4899" }],
  ["wav", { icon: FaFileAudio, color: "#EC4899" }],
  ["flac", { icon: FaFileAudio, color: "#EC4899" }],

  // Archives
  ["zip", { icon: FaFileArchive, color: "#EAB308" }],
  ["tar", { icon: FaFileArchive, color: "#EAB308" }],
  ["gz", { icon: FaFileArchive, color: "#EAB308" }],
  ["rar", { icon: FaFileArchive, color: "#EAB308" }],
  ["7z", { icon: FaFileArchive, color: "#EAB308" }],

  // Database
  ["sql", { icon: SiPostgresql, color: "#4169E1" }],
  ["db", { icon: SiSqlite, color: "#003B57" }],
  ["sqlite", { icon: SiSqlite, color: "#003B57" }],
]);

/**
 * Special filename to icon mapping (exact match, case-insensitive)
 * For files without extensions or with special names
 */
const FILENAME_ICON_MAP = new Map<string, FileIconConfig>([
  // Package managers
  ["package.json", { icon: SiNodedotjs, color: "#339933" }],
  ["package-lock.json", { icon: SiNpm, color: "#CB3837" }],
  ["pnpm-lock.yaml", { icon: SiPnpm, color: "#F69220" }],
  ["yarn.lock", { icon: SiYarn, color: "#2C8EBB" }],

  // Build tools
  ["dockerfile", { icon: SiDocker, color: "#2496ED" }],
  ["docker-compose.yml", { icon: SiDocker, color: "#2496ED" }],
  ["docker-compose.yaml", { icon: SiDocker, color: "#2496ED" }],
  ["webpack.config.js", { icon: SiWebpack, color: "#8DD6F9" }],
  ["vite.config.js", { icon: SiVite, color: "#646CFF" }],
  ["vite.config.ts", { icon: SiVite, color: "#646CFF" }],
  ["rollup.config.js", { icon: VscFileCode, color: "#EC4A3F" }],

  // Configuration
  ["tsconfig.json", { icon: SiTypescript, color: "#3178C6" }],
  ["jsconfig.json", { icon: SiJavascript, color: "#F7DF1E" }],
  [".eslintrc", { icon: SiEslint, color: "#4B32C3" }],
  [".eslintrc.js", { icon: SiEslint, color: "#4B32C3" }],
  [".eslintrc.json", { icon: SiEslint, color: "#4B32C3" }],
  [".prettierrc", { icon: SiPrettier, color: "#F7B93E" }],
  [".prettierrc.js", { icon: SiPrettier, color: "#F7B93E" }],
  [".prettierrc.json", { icon: SiPrettier, color: "#F7B93E" }],
  ["tailwind.config.js", { icon: SiTailwindcss, color: "#06B6D4" }],
  ["tailwind.config.ts", { icon: SiTailwindcss, color: "#06B6D4" }],
  ["postcss.config.js", { icon: SiPostcss, color: "#DD3A0A" }],

  // Testing
  ["jest.config.js", { icon: SiJest, color: "#C21325" }],
  ["vitest.config.js", { icon: SiVitest, color: "#6E9F18" }],
  ["vitest.config.ts", { icon: SiVitest, color: "#6E9F18" }],

  // Git
  [".gitignore", { icon: SiGit, color: "#F05032" }],
  [".gitattributes", { icon: SiGit, color: "#F05032" }],

  // Environment
  [".env", { icon: VscFileCode, color: "#EAB308" }],
  [".env.local", { icon: VscFileCode, color: "#EAB308" }],
  [".env.development", { icon: VscFileCode, color: "#EAB308" }],
  [".env.production", { icon: VscFileCode, color: "#EAB308" }],

  // Documentation
  ["readme.md", { icon: SiMarkdown, color: "#FFFFFF" }],
  ["readme", { icon: FaFileAlt, color: "#9CA3AF" }],
  ["license", { icon: FaFileAlt, color: "#9CA3AF" }],
  ["changelog.md", { icon: SiMarkdown, color: "#FFFFFF" }],

  // Java/Maven/Gradle
  ["pom.xml", { icon: FaJava, color: "#C71A36" }],
  ["build.gradle", { icon: SiGradle, color: "#02303A" }],
  ["settings.gradle", { icon: SiGradle, color: "#02303A" }],
]);

/**
 * Default fallback icon
 */
const DEFAULT_ICON: FileIconConfig = {
  icon: VscFile,
  color: "#9CA3AF",
};

/**
 * Get file icon configuration based on filename
 * Uses O(1) Map lookups for optimal performance
 *
 * @param fileName - The file name (with or without extension)
 * @param isDirectory - Whether this is a directory
 * @returns Icon configuration with icon component and color
 */
export function getFileIcon(fileName: string, isDirectory: boolean): FileIconConfig {
  // Directories don't get custom icons (handled separately in UI)
  if (isDirectory) {
    return DEFAULT_ICON;
  }

  const lowerFileName = fileName.toLowerCase();

  // 1. Check exact filename match first (highest priority)
  const filenameMatch = FILENAME_ICON_MAP.get(lowerFileName);
  if (filenameMatch) {
    return filenameMatch;
  }

  // 2. Extract extension and check extension map
  const lastDotIndex = fileName.lastIndexOf(".");
  if (lastDotIndex !== -1 && lastDotIndex < fileName.length - 1) {
    const extension = lowerFileName.slice(lastDotIndex + 1);
    const extensionMatch = FILE_ICON_MAP.get(extension);
    if (extensionMatch) {
      return extensionMatch;
    }
  }

  // 3. Check for special cases without extensions
  // Handle files like "Dockerfile", "Makefile", etc.
  if (lowerFileName.startsWith("dockerfile")) {
    return { icon: SiDocker, color: "#2496ED" };
  }
  if (lowerFileName === "makefile") {
    return { icon: VscFileCode, color: "#6B7280" };
  }
  if (lowerFileName === "rakefile") {
    return { icon: SiRuby, color: "#CC342D" };
  }

  // 4. Return default icon
  return DEFAULT_ICON;
}

/**
 * Preload commonly used icons to improve initial render performance
 * This can be called during app initialization
 */
export function preloadCommonIcons() {
  // Icons are already imported at module level, so they're available immediately
  // This function exists for future optimization if needed
  return true;
}
