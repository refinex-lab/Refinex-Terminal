import { invoke } from "@tauri-apps/api/core";

/**
 * List all files in a directory recursively, respecting .gitignore
 */
export async function listAllFiles(
  root: string,
  ignorePatterns: string[] = []
): Promise<string[]> {
  return await invoke<string[]>("list_all_files", {
    root,
    ignorePatterns,
  });
}

/**
 * Simple fuzzy matching score
 * Returns a score between 0 and 1, where 1 is a perfect match
 */
export function fuzzyMatch(pattern: string, text: string): number {
  const patternLower = pattern.toLowerCase();
  const textLower = text.toLowerCase();

  // Exact match gets highest score
  if (textLower === patternLower) {
    return 1;
  }

  // Contains match gets high score
  if (textLower.includes(patternLower)) {
    return 0.8;
  }

  // Fuzzy match: check if all pattern characters appear in order
  let patternIndex = 0;
  let textIndex = 0;
  let matchCount = 0;

  while (patternIndex < patternLower.length && textIndex < textLower.length) {
    if (patternLower[patternIndex] === textLower[textIndex]) {
      matchCount++;
      patternIndex++;
    }
    textIndex++;
  }

  // If not all pattern characters were found, no match
  if (patternIndex < patternLower.length) {
    return 0;
  }

  // Score based on how many characters matched and how close together they are
  const matchRatio = matchCount / patternLower.length;
  const densityRatio = matchCount / textLower.length;

  return matchRatio * densityRatio * 0.6;
}

/**
 * Filter and sort files by fuzzy match score
 */
export function fuzzyFilter(
  files: string[],
  pattern: string,
  limit: number = 50
): Array<{ path: string; score: number }> {
  if (!pattern) {
    return files.slice(0, limit).map((path) => ({ path, score: 1 }));
  }

  const results = files
    .map((path) => {
      // Extract filename for matching
      const fileName = path.split("/").pop() || path;
      const score = fuzzyMatch(pattern, fileName);
      return { path, score };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return results;
}
