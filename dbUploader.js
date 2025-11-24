// /dbUploader.js
import { parse } from 'csv-parse';
import fs from 'fs';
import path from 'path';
import sql from 'mssql';
import 'dotenv/config';
import AdmZip from 'adm-zip';
import { fileURLToPath } from 'url';

// ... (Keep extractAllZips exactly as it was) ...
function extractAllZips(downloadFolder) {
    // ... (Your existing code) ...
    const extractPath = path.join(process.cwd(), 'extracted_data');
    if (!fs.existsSync(extractPath)) fs.mkdirSync(extractPath, { recursive: true });
    // ... (rest of unzip logic) ...
    return extractPath;
}

// ... (Keep findAllCsvs, but remove the filter that ignores files) ...
function findAllCsvs(folderPath) {
    if (!fs.existsSync(folderPath)) return [];
    // We want ALL CSVs now, so we removed the filter that blocked 'additional_locations'
    return fs.readdirSync(folderPath)
        .filter(file => file.endsWith('.csv'))
        .map(file => path.join(folderPath, file));
}

// ============================================================
// 1. DEFINE YOUR SCHEMAS
// ============================================================
const SCHEMA_MAP = [
    {
        // LOGIC: If filename contains "additional_locations"
        fileKeyword: "Additional_Locations", 
        tableName: "Additional_Locations",
        columns: [
            "Applicant Name",
            "Archived",
            "Full Address",
            "Latitude",
            "Location Flags",
            "Longitude",
            "MAT IDf",
            "Occupancy Type",
            "Owner Country",
            "Owner Name",
            "Owner Postal Code",
            "Owner State",
            "Owner Street No",
            "Property Use",
            "Segment End Point Latitude",
            "Segment Length (miles)",
            "Segment Start Address",
            "Segment Start Point Longitude",
            "State",
            "Street Name",
            "Unit",
            "Water",
            "Year Built",
            "Zoning",
            "Street No",
            "Sewage",
            "Segment Start Point Latitude",
            "Segment End Point Longitude",
            "Segment End Address",
            "Postal Code",
            "Owner Unit",
            "Owner Street Name",
            "Owner Phone No",
            "Owner Email",
            "Owner City",
            "Mbl",
            "Lot Area",
            "Location ID",
            "Location",
            "Country",
            "City",
            "Building Type"
        ]
    },
    {
        // LOGIC: If filename contains "housing" (The main reports)
        // Put this LAST as a "catch-all" if your naming is fuzzy
        fileKeyword: "Housing-Record-Details", 
        tableName: "housing_details",
        columns: [
            "Record #",
            "Record Type",
            "Applicant Name",
            "Date Submitted",
            "Address",
            "Record Status",
            "Applicant Email",
            "Third Ticket Notes for Administrative Staff",
            "Applicant PhoneNo",
            "Archived",
            "Building Type",
            "Change Request Sent Date",
            "City",
            "Country",
            "Date Draft Started",
            "Date Last Re-submitted",
            "Department",
            "Expiration Date",
            "Historical Permit No",
            "Is Historical",
            "Is Renewal",
            "Last Record Activity",
            "Latitude",
            "Location",
            "Location Flags",
            "Location ID",
            "Longitude",
            "Lot Area",
            "MAT ID",
            "Mblac",
            "Owner Country",
            "Number of Versions",
            "Occupancy Type",
            "Number of Locations",
            "Owner City",
            "Owner Email",
            "Owner Name",
            "Owner Postal Code",
            "Owner Phone No",
            "Owner Street Name",
            "Owner State",
            "Owner Street No",
            "Owner Unit",
            "Permit/License Issued Date",
            "Postal Code",
            "Project Label",
            "Project Name",
            "Property Use",
            "Renewal #",
            "Renewal Submitted",
            "Segment End Point Latitude",
            "Segment End Address",
            "Segment End Point Longitude",
            "Segment Length (miles)",
            "Segment Start Address",
            "Segment Start Point Latitude",
            "Segment Start Point Longitude",
            "Sewage",
            "State",
            "Street Name",
            "Submitted Online",
            "Street No",
            "Total Paid",
            "Unit",
            "User Flags",
            "Waiting on Changes",
            "Water",
            "Year Built",
            "Zoning"
        ]
    },{
        
        fileKeyword: "Code Case Violations_multiEntry", 
        tableName: "[Housing_Regular_Violations]",
        columns: [
            "Record #",
            "Code / Description",
            "Responsible Party",
            "Unit(s)",
            "Status",
            "Picture",
            "Correction Required By:"
        ]
    },{
        
        fileKeyword: "Emergency Violations_multiEntry", 
        tableName: "[Housing_Emergency_Violations]",
        columns: [
            "Record #",
            "Code / Description",
            "Responsible Party",
            "Unit",
            "Correction Required By:",
            "Status",
            "Picture"
        ]
    }
];

export async function uploadCsvToDb(downloadFolder) {
    const csvFolderPath = extractAllZips(downloadFolder);
    const csvFiles = findAllCsvs(csvFolderPath);

    if (csvFiles.length === 0) {
        console.log('No CSV files found.');
        return;
    }

    // Database config
    const dbConfig = {
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        server: process.env.DB_SERVER,
        database: process.env.DB_DATABASE,
        options: { trustServerCertificate: true }
    };

    try {
        await sql.connect(dbConfig);
        
        // --- STEP 1: Process files one by one ---
        for (const filePath of csvFiles) {
            const fileName = path.basename(filePath).toLowerCase();
            console.log(`\n📄 Processing file: ${fileName}`);

            // --- STEP 2: Find the matching Schema ---
            const schema = SCHEMA_MAP.find(s => fileName.includes(s.fileKeyword));

            if (!schema) {
                console.warn(`⚠️ SKIPPING: No schema definition found for "${fileName}"`);
                continue;
            }

            console.log(`   -> Router: Mapped to table [${schema.tableName}]`);

            // --- STEP 3: Parse Data ---
            const allRecords = [];
            const parser = fs.createReadStream(filePath).pipe(parse({ columns: true, skip_empty_lines: true }));

            for await (const record of parser) {
                allRecords.push(record);
            }

            if (allRecords.length === 0) {
                console.log('   File was empty.');
                continue;
            }

            // --- STEP 4: Bulk Insert to the SPECIFIC Table ---
            const table = new sql.Table(schema.tableName);
            table.create = false;

            // Add columns from the Schema definition
            schema.columns.forEach(colName => {
                table.columns.add(colName, sql.NVarChar(sql.MAX), { nullable: true });
            });

            // Add rows
            for (const record of allRecords) {
                const rowValues = schema.columns.map(colName => record[colName] || null);
                table.rows.add(...rowValues);
            }

            // Execute
            console.log(`   Inserting ${allRecords.length} rows into ${schema.tableName}...`);
            const request = new sql.Request();
            await request.bulk(table);
            console.log(`   ✅ Success.`);
        }

        await sql.close();

    } catch (err) {
        console.error('Database error:', err);
    }

    // Cleanup
    try {
        fs.rmSync(csvFolderPath, { recursive: true, force: true });
    } catch (e) {}
}




// // /dbUploader.js

// import { parse } from 'csv-parse';
// import fs from 'fs';
// import path from 'path';
// import sql from 'mssql';
// import 'dotenv/config';
// import AdmZip from 'adm-zip'; 
// import { fileURLToPath } from 'url'; // Moved to top for ES Module compatibility

// /**
//  * Finds all .zip files in the download folder, 
//  * extracts them to the PROJECT ROOT/extracted_data, and deletes the zips.
//  */
// function extractAllZips(downloadFolder) {
//     // process.cwd() gets your project's main folder.
//     const extractPath = path.join(process.cwd(), 'extracted_data');
    
//     // Create the folder if it doesn't exist
//     if (!fs.existsSync(extractPath)) {
//         fs.mkdirSync(extractPath, { recursive: true });
//     }

//     // Find all .zip files in the download folder
//     const zipFiles = fs.readdirSync(downloadFolder)
//         .filter(file => file.endsWith('.zip'))
//         .map(file => path.join(downloadFolder, file));

//     if (zipFiles.length === 0) {
//         console.log('No .zip files found to extract.');
//         return extractPath; 
//     }

//     console.log(`Found ${zipFiles.length} zip files. Extracting to: ${extractPath}`);

//     for (const zipFilePath of zipFiles) {
//         try {
//             const zip = new AdmZip(zipFilePath);
//             zip.extractAllTo(extractPath, /*overwrite*/ true);
//             console.log(`Extracted: ${zipFilePath}`);
            
//             // Delete the .zip file
//             fs.unlinkSync(zipFilePath);
//             console.log(`Deleted: ${zipFilePath}`);
//         } catch (err) {
//             console.error(`Error processing ${zipFilePath}: ${err.message}`);
//         }
//     }

//     return extractPath;
// }

// /**
//  * Finds ALL .csv files in the specified folder.
//  * IGNORING files containing "additional_locations".
//  */
// function findAllCsvs(folderPath) {
//     if (!fs.existsSync(folderPath)) {
//         return []; 
//     }
    
//     const files = fs.readdirSync(folderPath)
//         .filter(file => {
//             const fileName = file.toLowerCase();
//             // 1. Must be a CSV
//             // 2. Must NOT contain "additional_locations"
//             return fileName.endsWith('.csv') && !fileName.includes('additional_locations');
//         });

//     if (files.length === 0) {
//         return [];
//     }

//     // Return an array of full file paths
//     return files.map(file => path.join(folderPath, file));
// }

// export async function uploadCsvToDb(downloadFolder) {
    
//     // 1. Extract zips and get the new folder path for CSVs
//     const csvFolderPath = extractAllZips(downloadFolder);
    
//     // 2. Find all CSVs (Filtering out the ones we don't want)
//     const csvFiles = findAllCsvs(csvFolderPath);
    
//     if (csvFiles.length === 0) {
//         console.log('No CSV files found after extraction. Exiting upload step.');
//         // Clean up the 'extracted' folder if it's empty
//         if (fs.existsSync(csvFolderPath)) {
//              fs.rmSync(csvFolderPath, { recursive: true, force: true });
//         }
//         return; 
//     }

//     console.log(`Found ${csvFiles.length} CSV files to process.`);
//     const allRecords = []; 

//     // 3. Database config
//     const dbConfig = {
//         user: process.env.DB_USER,
//         password: process.env.DB_PASSWORD,
//         server: process.env.DB_SERVER,
//         database: process.env.DB_DATABASE,
//         options: { trustServerCertificate: true }
//     };

//     // 4. Loop, parse, and add to 'allRecords'
//     for (const filePath of csvFiles) {
//         console.log(`Reading file: ${filePath}...`);
        
//         const parser = fs.createReadStream(filePath)
//             .pipe(parse({
//                 columns: true,
//                 skip_empty_lines: true
//             }));

//         try {
//             for await (const record of parser) {
//                 allRecords.push(record);
//             }
//         } catch (err) {
//             console.error(`Error reading ${filePath}:`, err.message);
//             throw new Error(`Failed to parse ${filePath}. Stopping process.`);
//         }
//     }

//     if (allRecords.length === 0) {
//         console.log('All CSV files were empty. Nothing to upload.');
//     } else {
//         // 5. Bulk insert all records
//         console.log(`Finished reading. Total records: ${allRecords.length}.`);

//         try {
//             await sql.connect(dbConfig);
            
//             // --- CLEAR THE TABLE FIRST ---
//             console.log('Clearing staging table (Reports_Staging_1)...');
//             const clearRequest = new sql.Request(); 
//             await clearRequest.query('TRUNCATE TABLE Reports_Staging_1');
            
//             // Define the table name
//             const table = new sql.Table('Reports_Staging_1');
//             table.create = false;

//             // --- Define the Columns List ---
//             const columns = [
//                 "Record #",
//                 "Record Type",
//                 "Applicant Name",
//                 "Date Submitted",
//                 "Address",
//                 "Record Status",
//                 "Applicant Email",
//                 "Third Ticket Notes for Administrative Staff",
//                 "Applicant PhoneNo",
//                 "Archived",
//                 "Building Type",
//                 "Change Request Sent Date",
//                 "City",
//                 "Country",
//                 "Date Draft Started",
//                 "Date Last Re-submitted",
//                 "Department",
//                 "Expiration Date",
//                 "Historical Permit No",
//                 "Is Historical",
//                 "Is Renewal",
//                 "Last Record Activity",
//                 "Latitude",
//                 "Location",
//                 "Location Flags",
//                 "Location ID",
//                 "Longitude",
//                 "Lot Area",
//                 "MAT ID",
//                 "Mblac",
//                 "Owner Country",
//                 "Number of Versions",
//                 "Occupancy Type",
//                 "Number of Locations",
//                 "Owner City",
//                 "Owner Email",
//                 "Owner Name",
//                 "Owner Postal Code",
//                 "Owner Phone No",
//                 "Owner Street Name",
//                 "Owner State",
//                 "Owner Street No",
//                 "Owner Unit",
//                 "Permit/License Issued Date",
//                 "Postal Code",
//                 "Project Label",
//                 "Project Name",
//                 "Property Use",
//                 "Renewal #",
//                 "Renewal Submitted",
//                 "Segment End Point Latitude",
//                 "Segment End Address",
//                 "Segment End Point Longitude",
//                 "Segment Length (miles)",
//                 "Segment Start Address",
//                 "Segment Start Point Latitude",
//                 "Segment Start Point Longitude",
//                 "Sewage",
//                 "State",
//                 "Street Name",
//                 "Submitted Online",
//                 "Street No",
//                 "Total Paid",
//                 "Unit",
//                 "User Flags",
//                 "Waiting on Changes",
//                 "Water",
//                 "Year Built",
//                 "Zoning"
//             ];

//             // Add Columns to Table Object
//             columns.forEach(colName => {
//                 table.columns.add(colName, sql.NVarChar(sql.MAX), { nullable: true });
//             });

//             // Add Rows
//             for (const record of allRecords) {
//                 const rowValues = columns.map(colName => record[colName] || null);
//                 table.rows.add(...rowValues);
//             }

//             // Execute Bulk Insert
//             const request = new sql.Request();
//             const result = await request.bulk(table);
//             console.log(`Successfully inserted ${result.rowsAffected} total rows.`);
            
//             await sql.close();

//         } catch (err) {
//             console.error('Error during database bulk insert:', err);
//             throw err;
//         }
//     }

//     // 6. Clean up processed files and 'extracted' folder
//     console.log('Cleaning up processed files...');
//     // try {
//     //     fs.rmSync(csvFolderPath, { recursive: true, force: true });
//     //     console.log('Deleted `extracted` folder.');
//     // } catch (err) {
//     //     console.error(`Failed to delete ${csvFolderPath}:`, err.message);
//     // }
// }

// // ==========================================
// // STANDALONE TEST BLOCK
// // ==========================================
// // This logic checks if you ran "node dbUploader.js" directly.

// if (process.argv[1] === fileURLToPath(import.meta.url)) {
    
//     console.log('\n--- 🧪 STARTING STANDALONE TEST 🧪 ---');

//     if (!process.env.DB_SERVER) {
//         console.error('❌ ERROR: Could not read .env file.');
//         console.error('   Make sure you have a .env file in the project root.');
//         process.exit(1);
//     }
//     console.log(`✅ Environment loaded. Target Server: ${process.env.DB_SERVER}`);

//     const testDownloadPath = path.join(process.cwd(), 'downloads');
//     console.log(`📂 Scanning folder: ${testDownloadPath}`);

//     uploadCsvToDb(testDownloadPath)
//         .then(() => {
//             console.log('--- ✅ TEST COMPLETED SUCCESSFULLY ---');
//             process.exit(0);
//         })
//         .catch((err) => {
//             console.error('--- ❌ TEST FAILED ---');
//             console.error(err);
//             process.exit(1);
//         });
// }