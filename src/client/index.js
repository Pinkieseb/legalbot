const fetch = require('node-fetch');
const cheerio = require('cheerio');
const { optimal } = require('optimal-select');
const Config = require('../utils/config');
const Logger = require('../utils/logger');
const HeaderManager = require('./headers');
const RetryManager = require('./retries');
const { ErrorFactory } = require('./errors');

class Crawler {
    constructor(options = {}) {
        this.config = new Config(options);
        this.logger = new Logger(this.config.get('logging'));
        this.headers = new HeaderManager(this.config);
        this.retryManager = new RetryManager(this.config.get('retryConfig'));
        
        this.activeRequests = new Set();
        this.requestQueue = [];
        this.pipelines = new Map();
        this.middleware = [];
        
        // Rate limiting state
        this.lastRequestTime = 0;
        this.requestCount = 0;
    }

    /**
     * Add a pipeline stage
     */
    addPipeline(name, pipeline) {
        if (typeof pipeline !== 'function') {
            throw new Error('Pipeline must be a function');
        }
        this.pipelines.set(name, pipeline);
        return this;
    }

    /**
     * Add middleware
     */
    use(middleware) {
        if (typeof middleware !== 'function') {
            throw new Error('Middleware must be a function');
        }
        this.middleware.push(middleware);
        return this;
    }

    /**
     * Execute pipeline with middleware
     */
    async executePipeline(name, context) {
        const pipeline = this.pipelines.get(name);
        if (!pipeline) {
            throw ErrorFactory.createError('pipeline', `Pipeline ${name} not found`);
        }

        try {
            // Create base context with crawler instance
            let currentContext = {
                ...context,
                crawler: this
            };

            // Execute middleware chain
            for (const middleware of this.middleware) {
                const result = await middleware(currentContext);
                if (result) {
                    currentContext = result;
                }
            }

            // Execute pipeline with final context
            return await pipeline(currentContext);
        } catch (error) {
            throw ErrorFactory.createError('pipeline', `Pipeline ${name} failed: ${error.message}`, {
                pipelineId: name,
                originalError: error
            });
        }
    }

    /**
     * Fetch a URL with rate limiting and retries
     */
    async fetch(url, options = {}) {
        const domain = HeaderManager.getDomainFromUrl(url);
        const headers = await this.headers.getHeaders(domain);

        const fetchWithRetries = async () => {
            await this.enforceRateLimit();

            const response = await fetch(url, {
                ...options,
                headers: { ...headers, ...options.headers }
            });

            if (!response.ok) {
                if (response.status === 429) {
                    const retryAfter = parseInt(response.headers.get('retry-after')) || 60;
                    throw ErrorFactory.createError('rateLimit', 'Rate limit exceeded', {
                        url,
                        statusCode: response.status,
                        retryAfter
                    });
                }

                throw ErrorFactory.createError('network', `HTTP ${response.status}`, {
                    url,
                    statusCode: response.status
                });
            }

            return response;
        };

        return this.retryManager.withRetries(fetchWithRetries, url);
    }

    /**
     * Parse HTML content
     */
    parse(html) {
        try {
            return cheerio.load(html, {
                normalizeWhitespace: true,
                decodeEntities: true
            });
        } catch (error) {
            throw ErrorFactory.createError('parse', 'Failed to parse HTML', {
                originalError: error
            });
        }
    }

    /**
     * Extract data using selectors
     */
    extract($, selectors) {
        const result = {};

        for (const [key, selector] of Object.entries(selectors)) {
            try {
                if (typeof selector === 'function') {
                    result[key] = selector($);
                } else {
                    const elements = $(selector);
                    result[key] = elements.length === 1 ? elements.text().trim() : 
                                 elements.map((_, el) => $(el).text().trim()).get();
                }
            } catch (error) {
                this.logger.warn(`Failed to extract ${key}`, { selector, error: error.message });
                result[key] = null;
            }
        }

        return result;
    }

    /**
     * Generate optimal CSS selector for an element
     */
    generateSelector($, element) {
        try {
            return optimal(element);
        } catch (error) {
            this.logger.warn('Failed to generate optimal selector', { error: error.message });
            return null;
        }
    }

    /**
     * Enforce rate limiting
     */
    async enforceRateLimit() {
        const { requestsPerSecond } = this.config.get('rateLimit');
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        const minInterval = 1000 / requestsPerSecond;

        if (timeSinceLastRequest < minInterval) {
            await new Promise(resolve => setTimeout(resolve, minInterval - timeSinceLastRequest));
        }

        this.lastRequestTime = Date.now();
        this.requestCount++;
    }

    /**
     * Get crawler statistics
     */
    getStats() {
        return {
            activeRequests: this.activeRequests.size,
            queuedRequests: this.requestQueue.length,
            totalRequests: this.requestCount,
            retryStats: this.retryManager.getStatistics(),
            pipelines: Array.from(this.pipelines.keys())
        };
    }

    /**
     * Reset crawler state
     */
    reset() {
        this.activeRequests.clear();
        this.requestQueue = [];
        this.requestCount = 0;
        this.lastRequestTime = 0;
        this.retryManager.clearHistory();
        this.headers.reset();
    }
}

module.exports = Crawler;
