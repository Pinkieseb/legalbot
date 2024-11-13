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
        console.log('Starting Australian Legal Cases collection...');
        console.log('This process will:');
        console.log('1. Start with 2024 cases for all Victorian courts');
        console.log('2. Work backwards year by year until reaching archive ends');
        console.log('3. Save results to output/aus_legal_cases.json');
        console.log('\nStarting collection...\n');

        // Execute the case collection pipeline
        const startTime = Date.now();
        const result = await crawler.executePipeline('collectCases', {});
        const endTime = Date.now();

        // Log completion statistics
        console.log('\nCollection completed successfully!');
        console.log('Summary:');
        console.log(`- Total cases collected: ${result.cases.length}`);
        console.log(`- Time taken: ${((endTime - startTime) / 1000 / 60).toFixed(2)} minutes`);
        console.log(`- Results saved to: ${process.cwd()}/output/aus_legal_cases.json`);

        // Exit successfully
        process.exit(0);
    } catch (error) {
        console.error('Fatal error during case collection:');
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
