import { type CLIType } from "@/lib/ai-block-detector";
import ClaudeIcon from "@/assets/icons/claude.svg?react";
import CodexIcon from "@/assets/icons/codex.svg?react";
import CopilotIcon from "@/assets/icons/copilot.svg?react";
import GeminiIcon from "@/assets/icons/gemini.svg?react";

interface CLIIconProps {
  type: CLIType;
  className?: string;
  size?: number;
}

/**
 * CLI Icon component - displays the appropriate icon for each AI CLI
 */
export function CLIIcon({ type, className = "", size = 16 }: CLIIconProps) {
  const style = {
    width: size,
    height: size,
  };

  switch (type) {
    case "claude":
      return <ClaudeIcon className={className} style={style} />;
    case "codex":
      return <CodexIcon className={className} style={style} />;
    case "copilot":
      return <CopilotIcon className={className} style={style} />;
    case "gemini":
      return <GeminiIcon className={className} style={style} />;
    default:
      return null;
  }
}
