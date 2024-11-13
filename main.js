const { createCrawler } = require('./src');

async function main() {
    // Create crawler instance with optimized settings for legal case collection
    const crawler = createCrawler({
        retry: {
            maxRetries: 5,              // More retries for reliability
            initialDelay: 2000,         // Start with 2 second delay
            maxDelay: 60000,            // Max 1 minute delay
            backoffFactor: 2            // Double delay after each retry
        },
        rateLimit: {
            requestsPerSecond: 9,       // 9 requests per second
            concurrency: 3              // Process 3 courts simultaneously
        },
        logging: {
            level: 'info',
            silent: false,
            format: 'json'
        }
    });

    try {
        console.log('Starting Australian Legal Cases processing...');
        console.log('\nPhase 1: Case Collection');
        console.log('This process will:');
        console.log('1. Start with 2024 cases for all Victorian courts');
        console.log('2. Work backwards year by year until reaching archive ends');
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

        console.log('\nPhase 2: Content Extraction');
        console.log('This process will:');
        console.log('1. Connect to MongoDB database');
        console.log('2. Extract full content from each case URL');
        console.log('3. Convert HTML content to Markdown');
        console.log('4. Save first 3 cases as markdown files');
        console.log('5. Store all cases in MongoDB');
        console.log('\nStarting content extraction...\n');

        // Execute the content extraction pipeline
        const extractionStartTime = Date.now();
        const extractionResult = await crawler.executePipeline('extractContent', {
            cases: collectionResult.cases
        });
        const extractionEndTime = Date.now();

        // Log extraction completion statistics
        console.log('\nContent Extraction completed successfully!');
        console.log('Extraction Summary:');
        console.log(`- Total cases processed: ${extractionResult.totalProcessed}`);
        console.log(`- Cases saved as markdown files: ${extractionResult.savedToFiles}`);
        console.log(`- Time taken: ${((extractionEndTime - extractionStartTime) / 1000 / 60).toFixed(2)} minutes`);

        // Log overall completion statistics
        const totalTime = (extractionEndTime - collectionStartTime) / 1000 / 60;
        console.log('\nOverall Process Summary:');
        console.log(`- Total cases collected and processed: ${collectionResult.cases.length}`);
        console.log(`- Total time taken: ${totalTime.toFixed(2)} minutes`);
        console.log('- All data has been saved to MongoDB and sample files generated');

        // Exit successfully
        process.exit(0);
    } catch (error) {
        console.error('Fatal error during processing:');
        console.error(error);
        
        // Exit with error
        process.exit(1);
    }
}

// Handle unhandled rejections
process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection:', error);
    process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    process.exit(1);
});

// Start the collection process
main();
