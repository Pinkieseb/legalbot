class Logger {
    constructor(config = {}) {
        this.level = config.level || 'info';
        this.silent = config.silent || false;
        this.format = config.format || 'json';
        
        // Log levels and their priorities
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
    }

    /**
     * Format log message based on configuration
     */
    formatMessage(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            ...meta
        };

        return this.format === 'json' 
            ? JSON.stringify(logEntry)
            : `[${timestamp}] ${level.toUpperCase()}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
    }

    /**
     * Check if level should be logged
     */
    shouldLog(level) {
        return !this.silent && this.levels[level] <= this.levels[this.level];
    }

    /**
     * Log methods for different levels
     */
    error(message, meta = {}) {
        if (this.shouldLog('error')) {
            console.error(this.formatMessage('error', message, meta));
        }
    }

    warn(message, meta = {}) {
        if (this.shouldLog('warn')) {
            console.warn(this.formatMessage('warn', message, meta));
        }
    }

    info(message, meta = {}) {
        if (this.shouldLog('info')) {
            console.info(this.formatMessage('info', message, meta));
        }
    }

    debug(message, meta = {}) {
        if (this.shouldLog('debug')) {
            console.debug(this.formatMessage('debug', message, meta));
        }
    }

    /**
     * Create a child logger with additional default metadata
     */
    child(defaultMeta = {}) {
        const childLogger = new Logger({
            level: this.level,
            silent: this.silent,
            format: this.format
        });

        // Override log methods to include default metadata
        ['error', 'warn', 'info', 'debug'].forEach(level => {
            childLogger[level] = (message, meta = {}) => {
                this[level](message, { ...defaultMeta, ...meta });
            };
        });

        return childLogger;
    }
}

module.exports = Logger;
