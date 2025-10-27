// /dbUploader.js

import { parse } from 'csv-parse';
import fs from 'fs';
import path from 'path';
import sql from 'mssql';
import 'dotenv/config';

// --- ADD THIS HELPER FUNCTION ---
// It finds the most recently downloaded CSV in the folder
function findLatestCsv(folderPath) {
    const files = fs.readdirSync(folderPath)
        .filter(file => file.endsWith('.csv')) // Get only CSVs
        .map(file => {
            const filePath = path.join(folderPath, file);
            return {
                name: filePath, // Store the full path
                time: fs.statSync(filePath).mtime.getTime() // Get modified time
            };
        })
        .sort((a, b) => b.time - a.time); // Sort newest first

    if (files.length === 0) {
        throw new Error(`No CSV file found in download folder: ${folderPath}`);
    }

    const latestFile = files[0].name;
    console.log('Found latest CSV:', latestFile);
    return latestFile; // Return the full path
}


export async function uploadCsvToDb(downloadFolder) {
    
    // --- UPDATE THIS LINE ---
    // Instead of a hardcoded path, call the function
    const filePath = findLatestCsv(downloadFolder);
    
    const records = [];

    // 1. Database config (Now reading from process.env)
    const dbConfig = {
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        server: process.env.DB_SERVER,
        database: process.env.DB_DATABASE,
        options: {
            trustServerCertificate: true
        }
    };

    // 2. Create a "parser" to read the CSV
    const parser = fs.createReadStream(filePath) // This will now use the *actual* file path
        .pipe(parse({
            columns: true, // Treat first row as headers
            skip_empty_lines: true
        }));

    // 3. Read the file stream
    console.log(`Reading CSV file from ${filePath}...`);
    for await (const record of parser) {
        records.push(record);
    }
    console.log(`Finished reading ${records.length} records.`);

    // ... (rest of your database upload logic) ...
}