const { DEFAULT_RETRY_CONFIG } = require('../utils/constants');
const { ErrorFactory } = require('./errors');

class RetryManager {
    constructor(config = {}) {
        this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
        this.retryHistory = new Map();
        this.retryLocks = new Map();
    }

    /**
     * Calculate delay with exponential backoff and jitter
     */
    calculateDelay(attempt) {
        const { initialDelay, maxDelay, backoffFactor } = this.config;
        
        // Calculate exponential backoff
        const exponentialDelay = initialDelay * Math.pow(backoffFactor, attempt - 1);
        
        // Add random jitter (±25% of the delay)
        const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
        
        // Apply jitter and ensure we don't exceed maxDelay
        return Math.min(exponentialDelay + jitter, maxDelay);
    }

    /**
     * Check if operation should be retried
     */
    shouldRetry(error, attempt, key) {
        if (attempt >= this.config.maxRetries) {
            return false;
        }

        // Check if error is retryable
        if (!ErrorFactory.isRetryableError(error)) {
            return false;
        }

        // Check rate limit specific conditions
        if (error.name === 'RateLimitError' && error.metadata.retryAfter) {
            return true;
        }

        return true;
    }

    /**
     * Get or create retry lock
     */
    async getRetryLock(key) {
        if (!this.retryLocks.has(key)) {
            this.retryLocks.set(key, Promise.resolve());
        }
        return this.retryLocks.get(key);
    }

    /**
     * Set retry lock
     */
    setRetryLock(key, promise) {
        this.retryLocks.set(key, promise);
    }

    /**
     * Execute operation with automatic retries and concurrency control
     */
    async withRetries(operation, key = null) {
        const retryKey = key || operation.toString();
        let attempt = 1;
        let lastError = null;

        while (attempt <= this.config.maxRetries) {
            try {
                // Wait for any existing retry operation to complete
                await this.getRetryLock(retryKey);

                // Create new lock for this attempt
                const currentLock = (async () => {
                    try {
                        const result = await operation();
                        // Clear retry history on success
                        this.retryHistory.delete(retryKey);
                        return result;
                    } catch (error) {
                        lastError = error;
                        if (!this.shouldRetry(error, attempt, retryKey)) {
                            throw error;
                        }

                        // Calculate delay
                        let delay = this.calculateDelay(attempt);
                        
                        // If it's a rate limit error with retry-after header, use that instead
                        if (error.name === 'RateLimitError' && error.metadata.retryAfter) {
                            delay = error.metadata.retryAfter * 1000;
                        }

                        // Update retry history
                        this.updateRetryHistory(retryKey, {
                            attempt,
                            error,
                            delay,
                            timestamp: Date.now()
                        });

                        // Wait before retrying
                        await this.sleep(delay);
                        throw error; // Re-throw to trigger next retry
                    }
                })();

                // Set the lock for this attempt
                this.setRetryLock(retryKey, currentLock);

                // Wait for the operation to complete
                return await currentLock;
            } catch (error) {
                if (!this.shouldRetry(error, attempt, retryKey)) {
                    throw error;
                }
                attempt++;
            }
        }

        // If we've exhausted all retries, throw the last error
        throw lastError;
    }

    /**
     * Update retry history for analysis
     */
    updateRetryHistory(key, attempt) {
        if (!this.retryHistory.has(key)) {
            this.retryHistory.set(key, []);
        }
        this.retryHistory.get(key).push(attempt);
    }

    /**
     * Get retry history for a specific operation
     */
    getRetryHistory(key) {
        return this.retryHistory.get(key) || [];
    }

    /**
     * Sleep for specified milliseconds
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Clear retry history and locks
     */
    clearHistory() {
        this.retryHistory.clear();
        this.retryLocks.clear();
    }

    /**
     * Get retry statistics
     */
    getStatistics() {
        const stats = {
            totalOperations: 0,
            totalRetries: 0,
            averageRetries: 0,
            maxRetries: 0,
            operationsWithRetries: 0,
            currentlyRetrying: this.retryLocks.size
        };

        this.retryHistory.forEach(attempts => {
            stats.totalOperations++;
            const retryCount = attempts.length;
            if (retryCount > 0) {
                stats.operationsWithRetries++;
                stats.totalRetries += retryCount;
                stats.maxRetries = Math.max(stats.maxRetries, retryCount);
            }
        });

        if (stats.operationsWithRetries > 0) {
            stats.averageRetries = stats.totalRetries / stats.operationsWithRetries;
        }

        return stats;
    }
}

module.exports = RetryManager;
