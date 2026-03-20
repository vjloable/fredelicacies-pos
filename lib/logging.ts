/**
 * Centralized logging utility for structured logging to Vercel Logs
 * All logs are JSON-formatted for easy parsing and searching
 */

type LogLevel = 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

/**
 * Internal logger function that outputs structured JSON
 */
function logMessage(level: LogLevel, message: string, error?: Error, context?: LogContext) {
  const logEntry = {
    level,
    timestamp: new Date().toISOString(),
    message,
    ...(error && { stack: error.stack, errorMessage: error.message }),
    ...context,
  };

  if (level === 'error') {
    console.error(JSON.stringify(logEntry));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(logEntry));
  } else {
    console.log(JSON.stringify(logEntry));
  }
}

/**
 * Public logging API
 */
export const log = {
  /**
   * Log informational messages
   * @param message - Log message
   * @param context - Additional context (userId, branchId, duration, etc.)
   */
  info: (message: string, context?: LogContext) => {
    logMessage('info', message, undefined, context);
  },

  /**
   * Log warning messages
   * @param message - Log message
   * @param context - Additional context
   */
  warn: (message: string, context?: LogContext) => {
    logMessage('warn', message, undefined, context);
  },

  /**
   * Log error messages
   * @param message - Log message
   * @param error - Error object (optional)
   * @param context - Additional context
   */
  error: (message: string, error?: Error, context?: LogContext) => {
    logMessage('error', message, error, context);
  },
};

/**
 * Helper: Generate request metadata for API logs
 */
export const getRequestContext = (req: Request) => {
  return {
    userId: req.headers.get('x-user-id'),
    branchId: req.headers.get('x-branch-id'),
    method: req.method,
    url: new URL(req.url).pathname,
  };
};

/**
 * Helper: Measure execution time
 */
export const measureTime = () => {
  const startTime = Date.now();
  return {
    duration: () => Date.now() - startTime,
  };
};
