

// (After your Puppeteer code finishes and downloads the file)
import { parse } from 'csv-parse';
import * as fs from 'fs';
import sql from 'mssql';

// 1. Database config
const dbConfig = {
    user: 'YourUser',
    password: 'YourPassword',
    server: 'YourServerName',
    database: 'YourDatabase',
    options: {
        trustServerCertificate: true // (or other connection options)
    }
};

// 2. Load the CSV data
const records = [];
const parser = fs.createReadStream('C:\\path\\to\\downloaded\\report.csv')
    .pipe(parse({
        columns: true, // Assumes first row is headers
        skip_empty_lines: true
    }));

parser.on('readable', function(){
    let record;
    while ((record = parser.read()) !== null) {
        records.push(record);
    }
});

// 3. When parsing is done, bulk insert
parser.on('end', async () => {
    try {
        await sql.connect(dbConfig);

        // This is the key: create a table structure in memory
        const table = new sql.Table('YourDatabaseTable');
        table.create = false; // We assume the table already exists
        
        // Add column definitions (must match your SQL table)
        table.columns.add('Column1Name', sql.VarChar(100), { nullable: true });
        table.columns.add('Column2Name', sql.Int, { nullable: true });
        // ... add all other columns

        // Add rows from the CSV
        for (const record of records) {
            table.rows.add(record.Column1Name, record.Column2Name /* ...etc */);
        }

        // Perform the bulk insert
        const request = new sql.Request();
        const result = await request.bulk(table);

        console.log(`Successfully inserted ${result.rowsAffected} rows.`);
        await sql.close();

    } catch (err) {
        console.error('Error connecting or inserting:', err);
    }
});