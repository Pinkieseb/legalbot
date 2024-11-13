/**
 * Default retry configuration with optimized settings
 */
exports.DEFAULT_RETRY_CONFIG = {
    maxRetries: 5,         // Increased for better reliability
    initialDelay: 2000,    // Start with 2 second delay
    maxDelay: 60000,       // Max 1 minute delay
    backoffFactor: 2,      // Double delay after each retry
};

/**
 * Default rate limiting configuration with dynamic concurrency
 */
exports.DEFAULT_RATE_LIMIT = {
    requestsPerSecond: 9,  // Increased from 2 to 9
    concurrency: Math.max(1, require('os').cpus().length - 1), // Dynamic based on CPU cores
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
    520, // Unknown Error
    521, // Web Server Is Down
    522, // Connection Timed Out
    523, // Origin Is Unreachable
    524, // A Timeout Occurred
];

/**
 * Default request headers with improved browser simulation
 */
exports.DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'DNT': '1',
    'Upgrade-Insecure-Requests': '1'
};

/**
 * Pipeline stages with concurrent processing support
 */
exports.PIPELINE_STAGES = {
    INIT: 'init',
    FETCH: 'fetch',
    PARSE: 'parse',
    EXTRACT: 'extract',
    TRANSFORM: 'transform',
    STORE: 'store',
    PARALLEL_FETCH: 'parallel_fetch',
    PARALLEL_PROCESS: 'parallel_process',
    BATCH_STORE: 'batch_store'
};

/**
 * Queue priorities with improved granularity
 */
exports.QUEUE_PRIORITY = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
    BACKGROUND: 4
};

/**
 * Default timeout values (in milliseconds) with optimized settings
 */
exports.TIMEOUTS = {
    REQUEST: 30000,        // 30 seconds for regular requests
    LONG_REQUEST: 60000,   // 60 seconds for potentially slow requests
    QUEUE_POP: 1000,       // 1 second for queue operations
    WORKER_IDLE: 5000,     // 5 seconds before considering a worker idle
    BATCH_INTERVAL: 2000,  // 2 seconds between batch operations
    CONNECTION: 10000      // 10 seconds for initial connections
};

/**
 * Batch processing configuration
 */
exports.BATCH_CONFIG = {
    DEFAULT_SIZE: 100,     // Default batch size for operations
    MAX_SIZE: 1000,       // Maximum batch size
    MIN_SIZE: 10,         // Minimum batch size
    FLUSH_INTERVAL: 5000  // Flush incomplete batches after 5 seconds
};

/**
 * Worker thread configuration
 */
exports.WORKER_CONFIG = {
    MAX_MEMORY_USAGE: 1024 * 1024 * 512, // 512MB per worker
    IDLE_TIMEOUT: 30000,                 // 30 seconds idle timeout
    RESTART_ON_MEMORY: true,             // Restart workers on high memory
    STARTUP_TIMEOUT: 5000                // 5 seconds startup timeout
};
