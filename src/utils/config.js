const { DEFAULT_RETRY_CONFIG, DEFAULT_RATE_LIMIT, DEFAULT_HEADERS, TIMEOUTS } = require('./constants');

class Config {
    constructor(options = {}) {
        this.retryConfig = {
            ...DEFAULT_RETRY_CONFIG,
            ...(options.retry || {})
        };

        this.rateLimit = {
            ...DEFAULT_RATE_LIMIT,
            ...(options.rateLimit || {})
        };

        this.headers = {
            ...DEFAULT_HEADERS,
            ...(options.headers || {})
        };

        this.queueOptions = {
            maxConcurrency: options.maxConcurrency || 5,
            timeout: options.timeout || TIMEOUTS.REQUEST,
            retryOnFailure: options.retryOnFailure !== false,
            priorityQueues: options.priorityQueues !== false,
        };

        this.storage = {
            type: options.storageType || 'memory',
            options: options.storageOptions || {},
        };

        this.logging = {
            level: options.logLevel || 'info',
            silent: options.silent || false,
            format: options.logFormat || 'json',
        };
    }

    /**
     * Update configuration at runtime
     */
    update(newOptions) {
        Object.assign(this, new Config(newOptions));
        return this;
    }

    /**
     * Get specific configuration section
     */
    get(section) {
        return this[section];
    }

    /**
     * Create a new configuration instance with merged options
     */
    static create(options = {}) {
        return new Config(options);
    }
}

module.exports = Config;
