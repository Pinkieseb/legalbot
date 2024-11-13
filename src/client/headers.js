const { DEFAULT_HEADERS } = require('../utils/constants');

class HeaderManager {
    constructor(config = {}) {
        this.defaultHeaders = { ...DEFAULT_HEADERS, ...config.headers };
        this.userAgents = config.userAgents || [DEFAULT_HEADERS['User-Agent']];
        this.customHeaders = new Map();
        this.domainHeaders = new Map();
        this.userAgentIndex = new Map();
        this.headerLocks = new Map();
    }

    /**
     * Get headers for a specific domain with concurrency control
     */
    async getHeaders(domain) {
        // Wait for any existing header operation to complete
        const existingLock = this.headerLocks.get(domain);
        if (existingLock) {
            await existingLock;
        }

        // Create new lock for this operation
        const lock = (async () => {
            const baseHeaders = { ...this.defaultHeaders };
            
            // Add any domain-specific headers
            if (this.domainHeaders.has(domain)) {
                Object.assign(baseHeaders, this.domainHeaders.get(domain));
            }

            // Add any custom headers
            if (this.customHeaders.has(domain)) {
                Object.assign(baseHeaders, this.customHeaders.get(domain));
            }

            // Rotate User-Agent per domain
            if (this.userAgents.length > 1) {
                baseHeaders['User-Agent'] = this.getNextUserAgent(domain);
            }

            return baseHeaders;
        })();

        this.headerLocks.set(domain, lock);
        return lock;
    }

    /**
     * Set custom headers for a specific domain
     */
    async setDomainHeaders(domain, headers) {
        const lock = (async () => {
            this.domainHeaders.set(domain, headers);
        })();
        this.headerLocks.set(domain, lock);
        await lock;
    }

    /**
     * Remove custom headers for a domain
     */
    async removeDomainHeaders(domain) {
        const lock = (async () => {
            this.domainHeaders.delete(domain);
        })();
        this.headerLocks.set(domain, lock);
        await lock;
    }

    /**
     * Get the next User-Agent in rotation for a specific domain
     */
    getNextUserAgent(domain) {
        let index = this.userAgentIndex.get(domain) || 0;
        const agent = this.userAgents[index];
        
        // Update index for next request
        index = (index + 1) % this.userAgents.length;
        this.userAgentIndex.set(domain, index);
        
        return agent;
    }

    /**
     * Add new User-Agent strings to the rotation
     */
    addUserAgents(userAgents) {
        if (Array.isArray(userAgents)) {
            this.userAgents.push(...userAgents);
        } else {
            this.userAgents.push(userAgents);
        }
    }

    /**
     * Set temporary custom headers for a specific request
     */
    async setCustomHeaders(domain, headers, duration = null) {
        const lock = (async () => {
            this.customHeaders.set(domain, headers);
            
            if (duration) {
                setTimeout(() => {
                    this.customHeaders.delete(domain);
                }, duration);
            }
        })();
        this.headerLocks.set(domain, lock);
        await lock;
    }

    /**
     * Clear all custom headers
     */
    reset() {
        this.customHeaders.clear();
        this.domainHeaders.clear();
        this.userAgentIndex.clear();
        this.headerLocks.clear();
    }

    /**
     * Get a normalized domain from a URL
     */
    static getDomainFromUrl(url) {
        try {
            const { hostname } = new URL(url);
            return hostname;
        } catch (error) {
            return null;
        }
    }

    /**
     * Get current header state for a domain
     */
    async getDomainState(domain) {
        const lock = (async () => ({
            customHeaders: this.customHeaders.get(domain),
            domainHeaders: this.domainHeaders.get(domain),
            currentUserAgent: this.userAgents[this.userAgentIndex.get(domain) || 0]
        }))();
        this.headerLocks.set(domain, lock);
        return lock;
    }
}

module.exports = HeaderManager;
