const { createCrawler } = require('./src');
const os = require('os');

async function main() {
    // Calculate optimal concurrency based on system resources
    const cpuCount = os.cpus().length;
    const defaultConcurrency = Math.max(1, Math.min(cpuCount - 1, 5)); // Limit to 5 workers max

    // Create crawler instance with optimized settings
    const crawler = createCrawler({
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
        logging: {
            level: 'info',
            silent: false,
            format: 'json'
        }
    });

    // Store crawler instance globally for cleanup handlers
    global.crawler = crawler;

    try {
        console.log('Starting Australian Legal Cases processing...');
        console.log('\nSystem Configuration:');
        console.log(`- CPU Cores: ${cpuCount}`);
        console.log(`- Concurrent Workers: ${defaultConcurrency}`);
        console.log(`- Request Rate: 9 per second`);

        console.log('\nPhase 1: Case Collection');
        console.log('This process will:');
        console.log('1. Start with 2024 cases for all Victorian courts');
        console.log('2. Work backwards year by year using parallel processing');
        console.log('3. Save results to output/aus_legal_cases.json');
        console.log('\nStarting collection...\n');

        // Execute the case collection pipeline
        const collectionStartTime = Date.now();
        const collectionResult = await crawler.executePipeline('collectCases', {});
        const collectionEndTime = Date.now();

        // Log collection completion statistics
        console.log('\nCase Collection completed successfully!');
        console.log('Collection Summary:');
        console.log(`- Total cases collected: ${collectionResult.cases.length}`);
        console.log(`- Time taken: ${((collectionEndTime - collectionStartTime) / 1000 / 60).toFixed(2)} minutes`);
        console.log(`- Results saved to: ${process.cwd()}/output/aus_legal_cases.json`);

        // Only proceed with content extraction if we have cases
        if (collectionResult.cases.length > 0) {
            console.log('\nPhase 2: Content Extraction');
            console.log('This process will:');
            console.log('1. Connect to MongoDB database');
            console.log('2. Extract full content from each case URL using worker threads');
            console.log('3. Convert HTML content to Markdown in parallel');
            console.log('4. Save first 3 cases as markdown files');
            console.log('5. Store all cases in MongoDB using batch operations');
            console.log('\nStarting content extraction...\n');

            // Execute the content extraction pipeline
            const extractionStartTime = Date.now();
            const extractionResult = await crawler.executePipeline('extractContent', {
                cases: collectionResult.cases,
                workerCount: defaultConcurrency
            });
            const extractionEndTime = Date.now();

            // Log extraction completion statistics
            console.log('\nContent Extraction completed successfully!');
            console.log('Extraction Summary:');
            console.log(`- Total cases processed: ${extractionResult.totalProcessed}`);
            console.log(`- Cases saved as markdown files: ${extractionResult.savedToFiles}`);
            console.log(`- Success rate: ${extractionResult.successRate}`);
            console.log(`- Time taken: ${((extractionEndTime - extractionStartTime) / 1000 / 60).toFixed(2)} minutes`);

            // Log overall completion statistics
            const totalTime = (extractionEndTime - collectionStartTime) / 1000 / 60;
            console.log('\nOverall Process Summary:');
            console.log(`- Total cases collected and processed: ${collectionResult.cases.length}`);
            console.log(`- Total time taken: ${totalTime.toFixed(2)} minutes`);
            console.log('- All data has been saved to MongoDB and sample files generated');
        } else {
            console.log('\nNo cases were collected. Skipping content extraction phase.');
        }

        // Exit successfully
        process.exit(0);
    } catch (error) {
        console.error('Fatal error during processing:');
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack,
            ...(error.metadata || {})
        });
        
        // Attempt graceful cleanup
        try {
            // Close any active worker threads
            if (global.crawler && global.crawler.workerPool) {
                await Promise.race([
                    global.crawler.workerPool.terminate(),
                    new Promise(resolve => setTimeout(resolve, 5000)) // 5s timeout
                ]);
            }
            
            // Close MongoDB connection if open
            if (global.mongoose && global.mongoose.connection.readyState === 1) {
                await Promise.race([
                    global.mongoose.connection.close(),
                    new Promise(resolve => setTimeout(resolve, 5000))
                ]);
            }
        } catch (cleanupError) {
            console.error('Error during cleanup:', cleanupError);
        }
        
        // Exit with error
        process.exit(1);
    }
}

// Enhanced error handlers with detailed logging
process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...(error.metadata || {})
    });
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...(error.metadata || {})
    });
    process.exit(1);
});

// Handle cleanup on termination signals
['SIGINT', 'SIGTERM'].forEach(signal => {
    process.on(signal, async () => {
        console.log(`\nReceived ${signal}, cleaning up...`);
        try {
            // Attempt graceful cleanup
            if (global.crawler && global.crawler.workerPool) {
                await Promise.race([
                    global.crawler.workerPool.terminate(),
                    new Promise(resolve => setTimeout(resolve, 5000))
                ]);
            }
            if (global.mongoose && global.mongoose.connection.readyState === 1) {
                await Promise.race([
                    global.mongoose.connection.close(),
                    new Promise(resolve => setTimeout(resolve, 5000))
                ]);
            }
            console.log('Cleanup completed');
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
        process.exit(0);
    });
});

// Start the collection process
main().catch(error => {
    console.error('Error in main:', error);
    process.exit(1);
});
