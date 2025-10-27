// /index.js

// Use 'import' to bring in your functions from the other files
import { downloadReport } from './reportDownloader.js';
import { uploadCsvToDb } from './dbUploader.js';

// A main 'async' function to control the flow
async function runProcess() {
    try {
        console.log('--- STEP 1: STARTING REPORT DOWNLOAD ---');
        const downloadedFolderPath = await downloadReport();
        console.log('Download step complete.');

        console.log('--- STEP 2: STARTING DATABASE UPLOAD ---');
        await uploadCsvToDb(downloadedFolderPath);
        console.log('Database upload complete.');

        console.log('*** Weekly process finished successfully! ***');

    } catch (error) {
        console.error('*** A fatal error occurred! ***', error.message);
        // process.exit(1); // Optional: exit with an error code
    }
}

// Run the main process
runProcess();