type Severity = "INFO" | "WARNING" | "ERROR";

function log(
  severity: Severity,
  message: string,
  extra?: Record<string, any>
) {
  const entry = {
    timestamp: new Date().toISOString(),
    severity,
    message,
    ...extra,
  };
  process.stdout.write(JSON.stringify(entry) + "\n");
}

export const logger = {
  info: (message: string, extra?: Record<string, any>) =>
    log("INFO", message, extra),
  warn: (message: string, extra?: Record<string, any>) =>
    log("WARNING", message, extra),
  error: (message: string, extra?: Record<string, any>) =>
    log("ERROR", message, extra),
};
