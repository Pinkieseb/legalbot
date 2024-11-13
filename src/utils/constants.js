/**
 * Default retry configuration
 */
exports.DEFAULT_RETRY_CONFIG = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffFactor: 2,
};

/**
 * Default rate limiting configuration
 */
exports.DEFAULT_RATE_LIMIT = {
    requestsPerSecond: 2,
    concurrency: 5,
};

/**
 * HTTP Status codes that should trigger a retry
 */
exports.RETRY_STATUS_CODES = [
    408, // Request Timeout
    429, // Too Many Requests
    500, // Internal Server Error
    502, // Bad Gateway
    503, // Service Unavailable
    504, // Gateway Timeout
];

/**
 * Default request headers
 */
exports.DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Connection': 'keep-alive',
};

/**
 * Pipeline stages
 */
exports.PIPELINE_STAGES = {
    INIT: 'init',
    FETCH: 'fetch',
    PARSE: 'parse',
    EXTRACT: 'extract',
    TRANSFORM: 'transform',
    STORE: 'store',
};

/**
 * Queue priorities
 */
exports.QUEUE_PRIORITY = {
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
};

/**
 * Default timeout values (in milliseconds)
 */
exports.TIMEOUTS = {
    REQUEST: 30000,
    QUEUE_POP: 1000,
};
