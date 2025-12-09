// /dbUploader.js
import { parse } from 'csv-parse';
import fs from 'fs';
import path from 'path';
import sql from 'mssql';
import 'dotenv/config';
import AdmZip from 'adm-zip';
import { fileURLToPath } from 'url';


function extractAllZips(downloadFolder) {
    const extractPath = path.join(process.cwd(), 'extracted_data');
    if (!fs.existsSync(extractPath)) fs.mkdirSync(extractPath, { recursive: true });

    const zipFiles = fs.readdirSync(downloadFolder)
        .filter(file => file.endsWith('.zip'))
        .map(file => path.join(downloadFolder, file));

    if (zipFiles.length === 0) {
        console.log('No .zip files found. Checking for loose CSVs...');
        return extractPath;
    }

    console.log(`Found ${zipFiles.length} zip files. Extracting to: ${extractPath}`);

    for (const zipFilePath of zipFiles) {
        try {
            const zip = new AdmZip(zipFilePath);
            zip.extractAllTo(extractPath, true);
            //fs.unlinkSync(zipFilePath); // Delete zip after extract
            console.log(`Extracted & Deleted: ${path.basename(zipFilePath)}`);
        } catch (err) {
            console.error(`Error processing zip ${zipFilePath}: ${err.message}`);
        }
    }
    return extractPath;
}

function findAllCsvs(folderPath) {
    if (!fs.existsSync(folderPath)) return [];
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
        fileKeyword: "additional_locations", 
        tableName: "Housing_Additional_Locations",
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
        fileKeyword: "housing-record-details", 
        tableName: "Housing_Details",
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
        
        fileKeyword: "code case violations_multientry", 
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
        
        fileKeyword: "emergency violations_multientry", 
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
        console.log('No CSV files found to process.');
        // Cleanup empty folder logic...
        return;
    }

    console.log(`\nFound ${csvFiles.length} CSV files. Starting DB Upload...`);

    const dbConfig = {
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        server: process.env.DB_SERVER,
        database: process.env.DB_DATABASE,
        options: { trustServerCertificate: true, encrypt: false }
    };

    // --- NEW: Track which tables we have already cleared ---
    const clearedTables = new Set();

    try {
        await sql.connect(dbConfig);

        for (const filePath of csvFiles) {
            const fileName = path.basename(filePath).toLowerCase();
            console.log(`\n📄 Processing: ${fileName}`);

            const schema = SCHEMA_MAP.find(s => fileName.includes(s.fileKeyword));

            if (!schema) {
                console.warn(`⚠️ SKIPPING: No schema found for "${fileName}"`);
                continue;
            }

            console.log(`   -> Mapped to table: [${schema.tableName}]`);

            // --- TRUNCATE LOGIC ---
            // Only truncate if we haven't touched this table yet in this run
            if (!clearedTables.has(schema.tableName)) {
                console.log(`   🧹 First time seeing ${schema.tableName}. Truncating...`);
                const clearReq = new sql.Request();
                await clearReq.query(`TRUNCATE TABLE ${schema.tableName}`);
                
                // Mark as cleared so we don't wipe it again for the next file
                clearedTables.add(schema.tableName);
            } else {
                console.log(`   ⬇️  Table ${schema.tableName} already cleared. Appending data...`);
            }

            // --- PARSE AND INSERT ---
            const allRecords = [];
            const parser = fs.createReadStream(filePath).pipe(parse({ columns: true, skip_empty_lines: true }));

            for await (const record of parser) {
                allRecords.push(record);
            }

            if (allRecords.length === 0) {
                console.log('   File is empty.');
                continue;
            }

            // Bulk Insert
            const table = new sql.Table(schema.tableName);
            table.create = false;

            schema.columns.forEach(colName => {
                table.columns.add(colName, sql.NVarChar(sql.MAX), { nullable: true });
            });

            for (const record of allRecords) {
                const rowValues = schema.columns.map(colName => record[colName] || null);
                table.rows.add(...rowValues);
            }

            console.log(`   Inserting ${allRecords.length} rows...`);
            const request = new sql.Request();
            await request.bulk(table);
            console.log(`   ✅ Success.`);
        }

        await sql.close();

    } catch (err) {
        console.error('❌ Database Error:', err);
    }

    // Cleanup logic...
    // try {
    //     fs.rmSync(csvFolderPath, { recursive: true, force: true });
    // } catch (e) { console.error('Cleanup error', e.message); }
}

// ==========================================
// STANDALONE TEST BLOCK
// ==========================================
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    console.log('\n--- STARTING STANDALONE TEST ---');

    if (!process.env.DB_SERVER) {
        console.error('❌ ERROR: Could not read .env file.');
        process.exit(1);
    }
    console.log(`✅ Environment loaded. Server: ${process.env.DB_SERVER}`);

    // Assumes files are in 'downloads' folder for testing
    const testDownloadPath = path.join(process.cwd(), 'downloads');
    console.log(`📂 Scanning folder: ${testDownloadPath}`);

    uploadCsvToDb(testDownloadPath)
        .then(() => {
            console.log('--- ✅ TEST COMPLETE ---');
            process.exit(0);
        })
        .catch((err) => {
            console.error('--- ❌ TEST FAILED ---', err);
            process.exit(1);
        });
}
