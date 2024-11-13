const Crawler = require('./client');
const { ErrorFactory } = require('./client/errors');
const { caseLawCollectionPipeline } = require('./flows/caselaw_casecollection');
const { caseLawContentExtractionPipeline } = require('./flows/caselaw_contentextraction');
const os = require('os');

/**
 * Example pipeline that extracts all links from a page with worker thread support
 */
const linkExtractorPipeline = async function(context) {
    const { crawler, url } = context;
    
    // Fetch the page
    const response = await crawler.fetch(url);
    const html = await response.text();
    
    // Parse the HTML
    const $ = crawler.parse(html);
    
    // Extract all links
    const links = $('a')
        .map((_, el) => $(el).attr('href'))
        .get()
        .filter(href => href && !href.startsWith('#'))
        .map(href => new URL(href, url).toString());
    
    return { links };
};

/**
 * Example pipeline that extracts specific elements from a page with worker thread support
 */
const elementExtractorPipeline = async function(context) {
    const { crawler, url, selectors } = context;
    
    if (!selectors || Object.keys(selectors).length === 0) {
        throw ErrorFactory.createError('validation', 'No selectors provided');
    }
    
    // Fetch and parse
    const response = await crawler.fetch(url);
    const html = await response.text();
    const $ = crawler.parse(html);
    
    // Extract data using provided selectors
    const data = crawler.extract($, selectors);
    
    return { data };
};

/**
 * Enhanced middleware that adds timing and resource usage information
 */
const enhancedMiddleware = async function(context) {
    const startUsage = process.cpuUsage();
    const startMemory = process.memoryUsage();
    
    // Add enhanced monitoring to context
    const enhancedContext = {
        ...context,
        monitoring: {
            startTime: Date.now(),
            startUsage,
            startMemory,
            addMetrics: (result) => {
                const endTime = Date.now();
                const cpuUsage = process.cpuUsage(startUsage);
                const memoryUsage = process.memoryUsage();
                
                return {
                    ...result,
                    metrics: {
                        duration: endTime - context.monitoring.startTime,
                        cpu: {
                            user: cpuUsage.user / 1000000, // Convert to seconds
                            system: cpuUsage.system / 1000000
                        },
                        memory: {
                            delta: {
                                heapUsed: memoryUsage.heapUsed - startMemory.heapUsed,
                                external: memoryUsage.external - startMemory.external
                            },
                            final: memoryUsage
                        }
                    }
                };
            }
        }
    };

    return enhancedContext;
};

/**
 * Create a crawler instance with optimized configuration
 */
function createCrawler(options = {}) {
    // Calculate optimal concurrency based on CPU cores
    const cpuCount = os.cpus().length;
    const defaultConcurrency = Math.max(1, cpuCount - 1);

    const crawler = new Crawler({
        retry: {
            maxRetries: 5,
            initialDelay: 2000,
            maxDelay: 60000,
            backoffFactor: 2
        },
        rateLimit: {
            requestsPerSecond: 9,
            concurrency: defaultConcurrency
        },
        worker: {
            maxMemoryUsage: 1024 * 1024 * 512, // 512MB per worker
            idleTimeout: 30000,
            restartOnMemory: true,
            startupTimeout: 5000
        },
        batch: {
            size: 100,
            maxSize: 1000,
            minSize: 10,
            flushInterval: 5000
        },
        logging: {
            level: 'info',
            silent: false,
            format: 'json'
        },
        ...options
    });

    // Add optimized pipelines
    crawler.addPipeline('extractLinks', linkExtractorPipeline);
    crawler.addPipeline('extractElements', elementExtractorPipeline);
    crawler.addPipeline('collectCases', caseLawCollectionPipeline);
    crawler.addPipeline('extractContent', caseLawContentExtractionPipeline);

    // Add enhanced middleware
    crawler.use(enhancedMiddleware);

    return crawler;
}

module.exports = {
    Crawler,
    createCrawler,
    ErrorFactory
};
