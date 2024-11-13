const path = require('path');
const fs = require('fs').promises;
const { ErrorFactory } = require('../client/errors');

class ConcurrencyPool {
    constructor(size) {
        this.size = size;
        this.running = 0;
        this.queue = [];
    }

    async add(fn) {
        if (this.running >= this.size) {
            await new Promise(resolve => this.queue.push(resolve));
        }
        this.running++;
        
        try {
            return await fn();
        } finally {
            this.running--;
            if (this.queue.length > 0) {
                const next = this.queue.shift();
                next();
            }
        }
    }

    async waitForAll() {
        if (this.running > 0) {
            await new Promise(resolve => this.queue.push(resolve));
        }
    }
}

class AusLegalCasesCrawler {
    constructor(crawler) {
        this.crawler = crawler;
        this.cases = [];
        this.baseUrls = [
            'https://www.austlii.edu.au/cgi-bin/viewtoc/au/cases/vic/VSC/',
            'https://www.austlii.edu.au/cgi-bin/viewtoc/au/cases/vic/VSCA/',
            'https://www.austlii.edu.au/cgi-bin/viewtoc/au/cases/vic/VCC/',
            'https://www.austlii.edu.au/cgi-bin/viewtoc/au/cases/vic/VMC/',
            'https://www.austlii.edu.au/cgi-bin/viewtoc/au/cases/vic/VCAT/'
        ];
        
        // Create concurrency pool based on config
        const concurrency = Math.min(5, this.crawler.config.get('rateLimit').concurrency);
        this.pool = new ConcurrencyPool(concurrency);
    }

    /**
     * Extract cases from a single page
     */
    async extractCasesFromPage(url) {
        const response = await this.crawler.fetch(url);
        const html = await response.text();
        const $ = this.crawler.parse(html);

        const pageCases = [];
        $('.card a').each((_, element) => {
            const $element = $(element);
            const href = $element.attr('href');
            const fullUrl = href.startsWith('http') ? 
                href : 
                `https://www.austlii.edu.au${href}`;
            
            pageCases.push({
                case_url: fullUrl,
                case_title: $element.text().trim()
            });
        });

        return pageCases;
    }

    /**
     * Process a single court for a given year
     */
    async processCourt(baseUrl, year) {
        const url = `${baseUrl}${year}/`;
        try {
            const cases = await this.extractCasesFromPage(url);
            this.crawler.logger.info(`Processed ${url}: found ${cases.length} cases`);
            return { cases, baseUrl, success: true };
        } catch (error) {
            if (error.statusCode === 500) {
                this.crawler.logger.info(`Reached end of archive for ${baseUrl} at year ${year}`);
                return { cases: [], baseUrl, success: false };
            }
            throw error;
        }
    }

    /**
     * Process a single year for all courts concurrently
     */
    async processYear(year) {
        const yearCases = [];
        const completedUrls = [];
        
        // Process courts concurrently with controlled concurrency
        const courtPromises = this.baseUrls.map(baseUrl => 
            this.pool.add(() => this.processCourt(baseUrl, year))
        );
        
        const results = await Promise.all(courtPromises);
        
        // Process results
        results.forEach(({ cases, baseUrl, success }) => {
            if (cases.length > 0) {
                yearCases.push(...cases);
            }
            if (!success) {
                completedUrls.push(baseUrl);
            }
        });

        // Remove completed URLs from future processing
        this.baseUrls = this.baseUrls.filter(url => !completedUrls.includes(url));
        
        return yearCases;
    }

    /**
     * Main execution flow
     */
    async execute() {
        let currentYear = 2024;
        
        try {
            // Continue until we've hit 500 errors for all URLs
            while (this.baseUrls.length > 0) {
                const yearCases = await this.processYear(currentYear);
                this.cases.push(...yearCases);
                
                this.crawler.logger.info(
                    `Year ${currentYear} completed. Total cases: ${this.cases.length}. ` +
                    `Remaining courts: ${this.baseUrls.length}`
                );
                
                // Save intermediate results
                await this.saveResults();
                
                currentYear--;

                // Wait for all pending requests to complete before proceeding to next year
                await this.pool.waitForAll();
            }

            this.crawler.logger.info('Case collection completed', {
                totalCases: this.cases.length,
                yearRange: `2024-${currentYear + 1}`
            });

            return this.cases;
        } catch (error) {
            this.crawler.logger.error('Error in case crawler execution', {
                error: error.message,
                year: currentYear,
                remainingCourts: this.baseUrls.length
            });
            throw error;
        }
    }

    /**
     * Save results to JSON file
     */
    async saveResults() {
        try {
            const outputDir = path.join(process.cwd(), 'output');
            await fs.mkdir(outputDir, { recursive: true });
            
            const outputPath = path.join(outputDir, 'aus_legal_cases.json');
            await fs.writeFile(
                outputPath,
                JSON.stringify({
                    metadata: {
                        timestamp: new Date().toISOString(),
                        totalCases: this.cases.length,
                        remainingCourts: this.baseUrls.length
                    },
                    cases: this.cases
                }, null, 2)
            );
            
            this.crawler.logger.info(`Results saved to ${outputPath}`);
        } catch (error) {
            this.crawler.logger.error('Error saving results', {
                error: error.message
            });
        }
    }
}

/**
 * Pipeline function for the crawler
 */
async function caseLawCollectionPipeline(context) {
    const { crawler } = context;
    
    const casesCrawler = new AusLegalCasesCrawler(crawler);
    const cases = await casesCrawler.execute();
    
    return { cases };
}

module.exports = {
    caseLawCollectionPipeline,
    AusLegalCasesCrawler
};
