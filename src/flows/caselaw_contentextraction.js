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

// MongoDB Schema with indexes for better query performance
const caseSchema = new mongoose.Schema({
    case_url: { type: String, required: true, unique: true, index: true },
    case_title: { type: String, required: true, index: true },
    content_markdown: { type: String, required: true },
    processed_at: { type: Date, default: Date.now, index: true }
});

const Case = mongoose.model('Case', caseSchema);

class CaseLawContentExtractor {
    constructor(crawler) {
        this.crawler = crawler;
        this.logger = crawler.logger;
        this.processedCount = 0;
        this.savedToFileCount = 0;
        this.failedCount = 0;
        
        // Initialize concurrency pool based on config
        const concurrency = Math.min(5, this.crawler.config.get('rateLimit').concurrency);
        this.pool = new ConcurrencyPool(concurrency);
        
        // Batch size for MongoDB operations
        this.batchSize = 100;
        this.pendingBatch = [];
    }

    async connectToMongoDB() {
        try {
            await mongoose.connect('mongodb://localhost:27017/auslaw', {
                maxPoolSize: 10
            });
            this.logger.info('Successfully connected to MongoDB');
        } catch (error) {
            this.logger.error('MongoDB connection error', { error: error.message });
            throw error;
        }
    }

    async extractContent(caseUrl) {
        const response = await this.crawler.fetch(caseUrl);
        const html = await response.text();
        const $ = this.crawler.parse(html);
        
        const articleContent = $('article.the-document').html();
        
        if (!articleContent) {
            throw new Error('Article content not found');
        }
        
        return turndownService.turndown(articleContent);
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

    async saveBatchToMongoDB() {
        if (this.pendingBatch.length === 0) return;

        try {
            // Use bulkWrite with upsert operations instead of insertMany
            const bulkOps = this.pendingBatch.map(doc => ({
                updateOne: {
                    filter: { case_url: doc.case_url },
                    update: { $set: doc },
                    upsert: true
                }
            }));

            await Case.bulkWrite(bulkOps, { ordered: false });
            this.pendingBatch = [];
        } catch (error) {
            // Log error but don't throw since some operations might have succeeded
            this.logger.error('Some batch operations failed', { 
                error: error.message,
                // Extract successful operations count if available
                successCount: error.result?.nMatched + error.result?.nUpserted || 0
            });
            // Clear batch to prevent retry loops
            this.pendingBatch = [];
        }
    }

    async processCase(caseData) {
        return this.pool.add(async () => {
            try {
                const markdown = await this.extractContent(caseData.case_url);
                
                // Save first 3 cases to files
                if (this.savedToFileCount < 3) {
                    await this.saveToFile(caseData.case_title, markdown);
                }
                
                // Add to MongoDB batch
                this.pendingBatch.push({
                    case_url: caseData.case_url,
                    case_title: caseData.case_title,
                    content_markdown: markdown,
                    processed_at: new Date()
                });

                // Save batch if it reaches the threshold
                if (this.pendingBatch.length >= this.batchSize) {
                    await this.saveBatchToMongoDB();
                }
                
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
        });
    }

    async processBatch(batch) {
        const results = await Promise.all(
            batch.map(caseData => this.processCase(caseData))
        );
        
        return results.filter(result => result).length;
    }

    async execute(cases) {
        await this.connectToMongoDB();
        
        this.totalCases = cases.length;
        this.logger.info('Starting content extraction', { 
            totalCases: this.totalCases,
            concurrency: this.pool.size,
            batchSize: this.batchSize
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
            
            // Wait for all pending operations to complete
            await this.pool.waitForAll();
            
            // Save any remaining documents in the batch
            if (this.pendingBatch.length > 0) {
                await this.saveBatchToMongoDB();
            }
            
            this.logger.info('Batch completed', {
                batchNumber,
                totalBatches,
                processedCount: this.processedCount,
                failedCount: this.failedCount,
                percentComplete: ((this.processedCount / this.totalCases) * 100).toFixed(2) + '%'
            });
        }

        // Close MongoDB connection
        await mongoose.connection.close();

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
