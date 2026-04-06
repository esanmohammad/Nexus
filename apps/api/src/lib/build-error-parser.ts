interface BuildErrorResult {
  summary: string;
  category: string;
  suggestion: string;
  autoFixable: boolean;
}

interface Pattern {
  regex: RegExp;
  category: string;
  summary?: string;
  suggestion?: string;
  getSummary?: (m: RegExpMatchArray) => string;
  getSuggestion?: (m: RegExpMatchArray) => string;
  autoFixable: boolean;
}

const PATTERNS: Pattern[] = [
  {
    regex: /npm ERR! missing script: start/i,
    category: "missing_start_script",
    summary: "Missing start script in package.json",
    suggestion: 'Add a "start" script to your package.json',
    autoFixable: true,
  },
  {
    regex: /ENOENT: no such file or directory/i,
    category: "file_not_found",
    summary: "File not found during build",
    suggestion: "Check that all referenced files exist in your project",
    autoFixable: false,
  },
  {
    regex: /Cannot find module '([^']+)'/,
    category: "missing_dependency",
    getSummary: (m: RegExpMatchArray) => `Missing Node.js module: ${m[1]}`,
    getSuggestion: (m: RegExpMatchArray) =>
      `Install the missing dependency: npm install ${m[1]}`,
    autoFixable: true,
  },
  {
    regex: /EADDRINUSE/i,
    category: "port_mismatch",
    summary: "Port already in use or port mismatch",
    suggestion:
      "Ensure your app listens on the correct PORT environment variable",
    autoFixable: false,
  },
  {
    regex: /ModuleNotFoundError: No module named '([^']+)'/,
    category: "missing_python_package",
    getSummary: (m: RegExpMatchArray) => `Missing Python package: ${m[1]}`,
    getSuggestion: (m: RegExpMatchArray) =>
      `Add ${m[1]} to your requirements.txt`,
    autoFixable: true,
  },
];

export function parseBuildError(log: string): BuildErrorResult {
  for (const pattern of PATTERNS) {
    const match = log.match(pattern.regex);
    if (match) {
      return {
        summary: pattern.getSummary
          ? pattern.getSummary(match)
          : pattern.summary!,
        category: pattern.category,
        suggestion: pattern.getSuggestion
          ? pattern.getSuggestion(match)
          : pattern.suggestion!,
        autoFixable: pattern.autoFixable,
      };
    }
  }
  return {
    summary: "Build failed with an unknown error",
    category: "unknown",
    suggestion: "Check the full build log for details",
    autoFixable: false,
  };
}
