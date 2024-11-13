const path = require('path');
const fs = require('fs').promises;
const mongoose = require('mongoose');
const TurndownService = require('turndown');

// Initialize Turndown
const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced'
});

// Concurrency Pool for managing parallel operations
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

// MongoDB Schema
const caseSchema = new mongoose.Schema({
    case_url: { type: String, required: true, unique: true },
    case_title: { type: String, required: true },
    content_markdown: { type: String, required: true },
    processed_at: { type: Date, default: Date.now }
});

const Case = mongoose.model('Case', caseSchema);

class CaseLawContentExtractor {
    constructor(crawler) {
        this.crawler = crawler;
        this.logger = crawler.logger;
        this.processedCount = 0;
        this.savedToFileCount = 0;
        this.failedCount = 0;
        
        // Initialize concurrency pool from crawler config
        const concurrency = this.crawler.config.get('rateLimit').concurrency;
        this.pool = new ConcurrencyPool(concurrency);
    }

    async connectToMongoDB() {
        try {
            await mongoose.connect('mongodb://localhost:27017/auslaw', {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
            this.logger.info('Successfully connected to MongoDB');
        } catch (error) {
            this.logger.error('MongoDB connection error', { error: error.message });
            throw error;
        }
    }

    async extractContent(caseUrl) {
        return this.pool.add(async () => {
            try {
                const response = await this.crawler.fetch(caseUrl);
                const html = await response.text();
                const $ = this.crawler.parse(html);
                
                // Extract the article content
                const articleContent = $('article.the-document').html();
                
                if (!articleContent) {
                    throw new Error('Article content not found');
                }
                
                // Convert to markdown
                const markdown = turndownService.turndown(articleContent);
                return markdown;
            } catch (error) {
                this.logger.error('Content extraction failed', { 
                    url: caseUrl, 
                    error: error.message 
                });
                throw error;
            }
        });
    }

    async saveToFile(caseTitle, markdown) {
        if (this.savedToFileCount >= 3) return;
        
        try {
            const outputDir = path.join(process.cwd(), 'output');
            await fs.mkdir(outputDir, { recursive: true });
            
            const filename = `case_${this.savedToFileCount + 1}.md`;
            const filepath = path.join(outputDir, filename);
            
            await fs.writeFile(filepath, `# ${caseTitle}\n\n${markdown}`);
            this.savedToFileCount++;
            
            this.logger.info('Saved markdown to file', { filepath });
        } catch (error) {
            this.logger.error('Failed to save markdown file', { error: error.message });
        }
    }

    async processCase(caseData) {
        try {
            // Extract and convert content using the pool
            const markdown = await this.extractContent(caseData.case_url);
            
            // Save first 3 cases to files
            if (this.savedToFileCount < 3) {
                await this.saveToFile(caseData.case_title, markdown);
            }
            
            // Save to MongoDB
            const caseDoc = new Case({
                case_url: caseData.case_url,
                case_title: caseData.case_title,
                content_markdown: markdown
            });
            
            await caseDoc.save();
            
            this.processedCount++;
            if (this.processedCount % 10 === 0) {
                this.logger.info('Processing progress', {
                    processed: this.processedCount,
                    failed: this.failedCount,
                    total: this.totalCases,
                    percentComplete: ((this.processedCount / this.totalCases) * 100).toFixed(2) + '%'
                });
            }
            
            return true;
        } catch (error) {
            this.failedCount++;
            this.logger.error('Case processing failed', {
                case: caseData.case_title,
                error: error.message
            });
            return false;
        }
    }

    async processBatch(batch) {
        const results = await Promise.all(
            batch.map(caseData => 
                this.pool.add(() => this.processCase(caseData))
            )
        );
        
        return results.filter(result => result).length;
    }

    async execute(cases) {
        await this.connectToMongoDB();
        
        this.totalCases = cases.length;
        this.logger.info('Starting content extraction', { 
            totalCases: this.totalCases,
            concurrency: this.pool.size
        });

        const batchSize = this.pool.size * 2;
        const totalBatches = Math.ceil(cases.length / batchSize);
        
        for (let i = 0; i < cases.length; i += batchSize) {
            const batch = cases.slice(i, i + batchSize);
            const batchNumber = Math.floor(i / batchSize) + 1;
            
            this.logger.info('Processing batch', {
                batchNumber,
                totalBatches,
                batchSize: batch.length,
                processedSoFar: this.processedCount
            });
            
            await this.processBatch(batch);
            
            // Wait for all pending operations to complete before next batch
            await this.pool.waitForAll();
            
            this.logger.info('Batch completed', {
                batchNumber,
                totalBatches,
                processedCount: this.processedCount,
                failedCount: this.failedCount,
                percentComplete: ((this.processedCount / this.totalCases) * 100).toFixed(2) + '%'
            });
        }

        this.logger.info('Content extraction completed', {
            totalProcessed: this.processedCount,
            totalFailed: this.failedCount,
            savedToFiles: this.savedToFileCount,
            successRate: ((this.processedCount / this.totalCases) * 100).toFixed(2) + '%'
        });

        return {
            totalProcessed: this.processedCount,
            totalFailed: this.failedCount,
            savedToFiles: this.savedToFileCount,
            successRate: ((this.processedCount / this.totalCases) * 100).toFixed(2) + '%'
        };
    }
}

/**
 * Pipeline function for content extraction
 */
async function caseLawContentExtractionPipeline(context) {
    const { crawler, cases } = context;
    
    if (!cases || !Array.isArray(cases)) {
        throw new Error('No cases data provided to content extraction pipeline');
    }
    
    const contentExtractor = new CaseLawContentExtractor(crawler);
    const result = await contentExtractor.execute(cases);
    
    return result;
}

module.exports = {
    caseLawContentExtractionPipeline,
    CaseLawContentExtractor
};
