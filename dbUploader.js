// /dbUploader.js

import { parse } from 'csv-parse';
import fs from 'fs';
import path from 'path';
import sql from 'mssql';
import 'dotenv/config';
import AdmZip from 'adm-zip'; // <-- Import adm-zip

/**
 * Finds all .zip files, extracts them, and deletes the zips.
 */
function extractAllZips(downloadFolder) {
    // Define a path for our extracted files
    const extractPath = path.join(downloadFolder, 'extracted');
    
    // Create the 'extracted' folder if it doesn't exist
    if (!fs.existsSync(extractPath)) {
        fs.mkdirSync(extractPath, { recursive: true });
    }

    // Find all .zip files in the main download folder
    const zipFiles = fs.readdirSync(downloadFolder)
        .filter(file => file.endsWith('.zip'))
        .map(file => path.join(downloadFolder, file)); // Get full paths

    if (zipFiles.length === 0) {
        console.log('No .zip files found to extract.');
        return extractPath; // Return the path anyway
    }

    console.log(`Found ${zipFiles.length} zip files. Extracting...`);

    for (const zipFilePath of zipFiles) {
        try {
            const zip = new AdmZip(zipFilePath);
            // Extract everything into our new folder
            zip.extractAllTo(extractPath, /*overwrite*/ true);
            console.log(`Extracted: ${zipFilePath}`);
            
            // Delete the .zip file after successful extraction
            fs.unlinkSync(zipFilePath);
            console.log(`Deleted: ${zipFilePath}`);
        } catch (err) {
            console.error(`Error processing ${zipFilePath}: ${err.message}`);
        }
    }

    // Return the path to where the CSVs now live
    return extractPath;
}

/**
 * Finds ALL .csv files in the specified folder.
 */
function findAllCsvs(folderPath) {
    if (!fs.existsSync(folderPath)) {
        return []; // Folder might not exist if no zips were found
    }
    
    const files = fs.readdirSync(folderPath)
        .filter(file => file.endsWith('.csv'));

    if (files.length === 0) {
        return [];
    }

    // Return an array of full file paths
    return files.map(file => path.join(folderPath, file));
}

export async function uploadCsvToDb(downloadFolder) {
    
    // --- THIS IS THE NEW FIRST STEP ---
    // Extract zips and get the new folder path for CSVs
    const csvFolderPath = extractAllZips(downloadFolder);
    
    // Find all CSVs in the 'extracted' folder
    const csvFiles = findAllCsvs(csvFolderPath);
    
    if (csvFiles.length === 0) {
        console.log('No CSV files found after extraction. Exiting upload step.');
        // Clean up the empty 'extracted' folder
        if (fs.existsSync(csvFolderPath)) {
             fs.rmSync(csvFolderPath, { recursive: true, force: true });
        }
        return; // Nothing to do
    }

    console.log(`Found ${csvFiles.length} CSV files to process.`);
    const allRecords = []; // This will hold records from ALL files

    // 1. Database config (no change)
    const dbConfig = {
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        server: process.env.DB_SERVER,
        database: process.env.DB_DATABASE,
        options: { trustServerCertificate: true }
    };

    // 2. Loop, parse, and add to 'allRecords' (no change)
    for (const filePath of csvFiles) {
        console.log(`Reading file: ${filePath}...`);
        
        const parser = fs.createReadStream(filePath)
            .pipe(parse({
                columns: true,
                skip_empty_lines: true
            }));

        try {
            for await (const record of parser) {
                allRecords.push(record);
            }
        } catch (err) {
            console.error(`Error reading ${filePath}:`, err.message);
            throw new Error(`Failed to parse ${filePath}. Stopping process.`);
        }
    }

    if (allRecords.length === 0) {
        console.log('All CSV files were empty. Nothing to upload.');
    } else {
        // 3. Bulk insert all records (no change)
        console.log(`Finished reading. Total records: ${allRecords.length}.`);
        try {
            await sql.connect(dbConfig);
            const table = new sql.Table('YourDatabaseTable');
            table.create = false;

            // --- Define your table columns (no change) ---
            table.columns.add('Column1Name', sql.VarChar(100), { nullable: true });
            table.columns.add('Column2Name', sql.Int, { nullable: true });
            // ... add all other columns ...

            for (const record of allRecords) {
                table.rows.add(
                    record.Column1Name,
                    record.Column2Name
                    // ... add all other record fields ...
                );
            }

            const request = new sql.Request();
            const result = await request.bulk(table);
            console.log(`Successfully inserted ${result.rowsAffected} total rows.`);
            await sql.close();

        } catch (err) {
            console.error('Error during database bulk insert:', err);
            throw err;
        }
    }

    // 4. (IMPORTANT) Clean up processed files and 'extracted' folder
    console.log('Cleaning up processed files...');
    // We can just delete the entire 'extracted' folder now
    try {
        fs.rmSync(csvFolderPath, { recursive: true, force: true });
        console.log('Deleted `extracted` folder.');
    } catch (err) {
        console.error(`Failed to delete ${csvFolderPath}:`, err.message);
    }
}