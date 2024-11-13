const Crawler = require('./client');
const { ErrorFactory } = require('./client/errors');
const { caseLawCollectionPipeline } = require('./flows/caselaw_casecollection');
const { caseLawContentExtractionPipeline } = require('./flows/caselaw_contentextraction');

/**
 * Example pipeline that extracts all links from a page
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
 * Example pipeline that extracts specific elements from a page
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
 * Middleware that adds timing information
 */
const timingMiddleware = async function(context) {
    // Add timing to context and return enhanced context
    return {
        ...context,
        timing: {
            startTime: Date.now(),
            addEndTime: (result) => ({
                ...result,
                timing: {
                    ...context.timing,
                    endTime: Date.now(),
                    duration: Date.now() - context.timing.startTime
                }
            })
        }
    };
};

/**
 * Create a crawler instance with example configuration
 */
function createCrawler(options = {}) {
    const crawler = new Crawler({
        retry: {
            maxRetries: 3,
            initialDelay: 1000,
            maxDelay: 30000,
            backoffFactor: 2
        },
        rateLimit: {
            requestsPerSecond: 2,
            concurrency: 5
        },
        logging: {
            level: 'info',
            silent: false
        },
        ...options
    });

    // Add default pipelines
    crawler.addPipeline('extractLinks', linkExtractorPipeline);
    crawler.addPipeline('extractElements', elementExtractorPipeline);
    crawler.addPipeline('collectCases', caseLawCollectionPipeline);
    crawler.addPipeline('extractContent', caseLawContentExtractionPipeline);

    // Add default middleware
    crawler.use(timingMiddleware);

    return crawler;
}

module.exports = {
    Crawler,
    createCrawler,
    ErrorFactory
};
