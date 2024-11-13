/**
 * Base error class for crawler-specific errors
 */
class CrawlerError extends Error {
    constructor(message, options = {}) {
        super(message);
        this.name = this.constructor.name;
        this.timestamp = new Date();
        this.url = options.url;
        this.statusCode = options.statusCode;
        this.retryable = options.retryable ?? true;
        this.metadata = options.metadata || {};
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            timestamp: this.timestamp,
            url: this.url,
            statusCode: this.statusCode,
            retryable: this.retryable,
            metadata: this.metadata,
            stack: this.stack
        };
    }
}

/**
 * Network-related errors
 */
class NetworkError extends CrawlerError {
    constructor(message, options = {}) {
        super(message, { ...options, retryable: true });
    }
}

/**
 * Rate limiting errors
 */
class RateLimitError extends CrawlerError {
    constructor(message, options = {}) {
        super(message, {
            ...options,
            retryable: true,
            metadata: {
                ...options.metadata,
                retryAfter: options.retryAfter
            }
        });
    }
}

/**
 * Parsing errors
 */
class ParseError extends CrawlerError {
    constructor(message, options = {}) {
        super(message, { ...options, retryable: false });
    }
}

/**
 * Validation errors
 */
class ValidationError extends CrawlerError {
    constructor(message, options = {}) {
        super(message, { ...options, retryable: false });
    }
}

/**
 * Pipeline errors
 */
class PipelineError extends CrawlerError {
    constructor(message, options = {}) {
        super(message, {
            ...options,
            metadata: {
                ...options.metadata,
                stage: options.stage,
                pipelineId: options.pipelineId
            }
        });
    }
}

/**
 * Queue errors
 */
class QueueError extends CrawlerError {
    constructor(message, options = {}) {
        super(message, {
            ...options,
            metadata: {
                ...options.metadata,
                queueName: options.queueName
            }
        });
    }
}

/**
 * Error factory for creating appropriate error instances
 */
class ErrorFactory {
    static createError(type, message, options = {}) {
        const errorMap = {
            network: NetworkError,
            rateLimit: RateLimitError,
            parse: ParseError,
            validation: ValidationError,
            pipeline: PipelineError,
            queue: QueueError
        };

        const ErrorClass = errorMap[type] || CrawlerError;
        return new ErrorClass(message, options);
    }

    static isRetryableError(error) {
        if (error instanceof CrawlerError) {
            return error.retryable;
        }
        // Handle native errors and network errors
        return error.code === 'ECONNRESET' || 
               error.code === 'ECONNREFUSED' ||
               error.code === 'ETIMEDOUT' ||
               error.type === 'request-timeout';
    }
}

module.exports = {
    CrawlerError,
    NetworkError,
    RateLimitError,
    ParseError,
    ValidationError,
    PipelineError,
    QueueError,
    ErrorFactory
};
