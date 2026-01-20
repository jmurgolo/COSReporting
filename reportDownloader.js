// /reportDownloader.js

// Make sure to import everything this file needs
import 'dotenv/config';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

const reportSelectors = [
    '#reports-menu-records-housing-record-details',
    '#reports-menu-records-housing-regular-and-emergency-violations',
    '#reports-menu-records-housing-general-details'
    // Add more here easily:
    // '#reports-menu-records-another-report-3',
];

/**
 * Polls the 'downloads' folder.
 * Resolves when a new .zip or .csv appears and there are no .crdownload files.
 */
async function waitForDownloadsToFinish(downloadPath) {
    console.log(`   👀 Watching folder for download: ${downloadPath}`);
    
    return new Promise((resolve, reject) => {
        // Check every 2 seconds
        const interval = setInterval(() => {
            try {
                const files = fs.readdirSync(downloadPath);

                // Check for "In Progress" Chrome files
                const isDownloading = files.some(f => f.endsWith('.crdownload'));
                
                // Check for "Completed" files (Zip or CSV)
                const hasFile = files.some(f => f.endsWith('.zip') || f.endsWith('.csv'));

                if (!isDownloading && hasFile) {
                    console.log('   ✅ Download detected and finished.');
                    clearInterval(interval);
                    resolve();
                }
            } catch (err) {
                console.log('   ...waiting for download folder...');
            }
        }, 2000);

        // Safety Timeout: Stop waiting after 2 minutes
        setTimeout(() => {
            clearInterval(interval);
            // We resolve anyway to let the script try to continue, 
            // but you could reject() if you want it to fail hard.
            console.warn('   ⚠️ Wait time exceeded (2 mins). Proceeding anyway.');
            resolve(); 
        }, 120000);
    });
}

/**
 * Handles the logic for a specific row:
 * 1. Checks if the status is "Finished" or "Pending".
 * 2. If "Pending", clicks Refresh, waits, and recurses.
 * 3. If "Finished", clicks Download.
 */
async function handleDownloadRow(page, rowIndex) {
    // Construct the selector for this specific row
    const rowSelector = `tbody tr:nth-child(${rowIndex})`;
    const statusSelector = `${rowSelector} td:nth-child(3)`; // The status column
    const downloadBtnSelector = `${rowSelector} .btn`;       // The download button
    
    // XPath to find the refresh button specifically
    const refreshBtnXPath = "//button[contains(., 'Refresh')]";

    console.log(`Processing Row #${rowIndex}...`);

    // --- LOOP: Keep checking/refreshing until "Finished" ---
    while (true) {
        // 1. Wait for the status cell to be visible
        await page.waitForSelector(statusSelector, { visible: true });

        // 2. Get the text inside the status cell
        const statusText = await page.$eval(statusSelector, el => el.innerText.trim());
        console.log(`Row ${rowIndex} Status: "${statusText}"`);

        if (statusText.toLowerCase().includes('finished')) {
            // --- SUCCESS CASE ---
            console.log('Status is Finished. Clicking Download...');
            
            // Click download
            await page.waitForSelector(downloadBtnSelector);
            await page.click(downloadBtnSelector);
            
            // Wait for download (using your helper or network idle)
            console.log('Download triggered. Waiting for completion...');
            await page.waitForNetworkIdle({ idleTime: 2000, timeout: 60000 });
            
            return; // Exit function, we are done with this file
            
        } else {
            // --- PENDING CASE ---
            console.log('Report not ready. Clicking Refresh...');

            const [refreshBtn] = await page.$x(refreshBtnXPath);
            if (refreshBtn) {
                await refreshBtn.click();
                
                // Wait for the table to reload (3 seconds)
                await new Promise(r => setTimeout(r, 3000));
                
                // IMPORTANT: Since we refreshed, the page structure rebuilt. 
                // We loop back to the top to re-acquire the status text.
            } else {
                throw new Error("Status is not Finished, but Refresh button is missing!");
            }
        }
    }
}

/**
 * MAIN FUNCTION: Downloads the latest version of the specific reports.
 * Robustly handles "Pending", "Processing", and empty loading states.
 */
/**
 * MAIN FUNCTION: Downloads the latest version of the specific reports.
 * Includes DEBUGGING LOGS to inspect table content.
 */
async function downloadLatestReports(page) {
   // --- TRANSFORM THE IDs INTO NAMES ---
    const targetReportNames = reportSelectors.map(selector => {
        return selector
            .replace('#reports-menu-records-', '') // 1. Remove the prefix
            .replace(/-/g, ' ');                   // 2. Replace ALL hyphens with spaces
    });

    // DEBUG: Show what names we generated to ensure they look right
    console.log('--- Target Report Names Generated ---');
    console.log(targetReportNames);
    console.log('-----------------------------------');

    const refreshBtnXPath = "//button[contains(., 'Refresh')]";

    console.log('--- Starting Smart Download Process ---');

    for (const reportName of targetReportNames) {
        console.log(`\n🔍 Searching for report: "${reportName}"`);
        
        let isDownloaded = false;

        while (!isDownloaded) {
            
            // 1. Find the Row Index
            const rowIndex = await page.$$eval('tbody tr', (rows, nameToFind) => {
                const target = nameToFind.toLowerCase().trim();
                
                for (let i = 0; i < rows.length; i++) {
                    // We grab the raw text content and clean it up
                    const rawText = rows[i].querySelector('td:nth-child(1)').textContent;
                    const cleanName = rawText.trim().toLowerCase();
                    
                    // Comparison Check
                    if (cleanName === target) {
                        return i + 1;
                    }
                }
                return null;
            }, reportName);

            if (!rowIndex) {
                console.error(`❌ Report "${reportName}" NOT found.`);
                console.log(`   (Check the debug dump above to see why the names didn't match)`);
                break; 
            }

            console.log(`   ✅ Found at Row #${rowIndex}`);

            // 2. Define Selectors
            const rowSelector = `tbody tr:nth-child(${rowIndex})`;
            const statusSelector = `${rowSelector} td:nth-child(3)`;
            const downloadBtnSelector = `${rowSelector} .btn`;

            // 3. Wait for Status Text
            await page.waitForSelector(statusSelector, { visible: true });
            
            // Get status text
            const statusText = await page.$eval(statusSelector, el => el.textContent.trim().toLowerCase());
            console.log(`   Status Detected: "[${statusText}]"`);

            if (statusText.includes('finished')) {
                console.log('   Clicking Download...');
                await page.click(downloadBtnSelector);
                
                // --- USE YOUR FILE SYSTEM HELPER HERE ---
                const downloadPath = path.join(process.cwd(), 'downloads');
                await waitForDownloadsToFinish(downloadPath);
                
                console.log('   ⬇️ Download complete.');
                isDownloaded = true;
                
            } else if (statusText.includes('pending') || statusText.includes('processing') || statusText === '') {
               console.log('   ⏳ Status is Pending. Clicking Refresh...');

                // 1. Try to find the button using the text "Refresh"
                // NEW SYNTAX: We use 'xpath/' prefix inside the standard selector
                let [refreshBtn] = await page.$$("xpath///button[contains(., 'Refresh')]");

                // 2. BACKUP: If text search fails, find the button by the icon class (fa-refresh)
                if (!refreshBtn) {
                    console.log('   (Text match failed, trying icon match...)');
                    
                    // Check for the icon
                    const icon = await page.$('button .fa-refresh');
                    
                    if (icon) {
                        // Find the parent button of that icon using XPath
                        // NEW SYNTAX: 'xpath/' prefix
                        let [parentBtn] = await page.$$("xpath///i[contains(@class, 'fa-refresh')]/..");
                        refreshBtn = parentBtn;
                    }
                }

                if (refreshBtn) {
                    console.log('   Found Refresh button. Force-clicking via JS...');
                    
                    // --- THE FIX: FORCE CLICK ---
                    // We execute standard JavaScript inside the browser to click the element.
                    // This bypasses Puppeteer's "is this visible?" checks and overlay problems.
                    await page.evaluate(el => el.click(), refreshBtn);

                    console.log('   🔄 Page refreshing... waiting 5s...');
                    await new Promise(r => setTimeout(r, 5000));
                } else {
                    throw new Error("Cannot find Refresh button!");
                }
            } else {
                console.error(`   ❌ Unknown Status: "${statusText}". Skipping.`);
                break;
            }
        }
    }
}

// Use 'export' to make this function available to other files
export async function downloadReport() {
    console.log('Launching browser...');
    
    const downloadPath = path.join(process.cwd(), 'downloads');
    if (!fs.existsSync(downloadPath)) {
        fs.mkdirSync(downloadPath);
        console.log('Created downloads folder:', downloadPath);
    }

    const browser = await puppeteer.launch({ headless: false,
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
     });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        const client = await page.target().createCDPSession();
        await client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: downloadPath,
        });

        console.log('Navigating to login page...');
        await page.goto(process.env.WEBSITE_ADDRESS, {
            waitUntil: 'networkidle2'
        });
        
        console.log('Logging in... ');

        // Click on <input> [placeholder="Email address"]
        await page.waitForSelector('[placeholder="Email address"]');
        await page.click('[placeholder="Email address"]');

        // Fill "jmurgolo@spring... on <input> [placeholder="Email address"]
        await page.waitForSelector('[placeholder="Email address"]:not([disabled])');
        await page.type('[placeholder="Email address"]', process.env.WEBSITE_USERNAME);

        // Press Enter on input
        await page.waitForSelector('[placeholder="Email address"]');
        await page.keyboard.press('Enter');

        // Click on <input> [placeholder="Password"]
        await page.waitForSelector('[placeholder="Password"]');
        await page.click('[placeholder="Password"]');

        // Fill "SynQ%PMmVdgFEhz... on <input> [placeholder="Password"]
        await page.waitForSelector('[placeholder="Password"]:not([disabled])');
        await page.type('[placeholder="Password"]', process.env.WEBSITE_PASSWORD);

        // Press Enter on input
        await page.waitForSelector('[placeholder="Password"]');
        await page.keyboard.press('Enter');

        // Click on <svg> .MuiButtonBase-root:nth-child(2) [data-testid="ExpandMoreIcon"]
        await page.waitForSelector('.MuiButtonBase-root:nth-child(2) [data-testid="ExpandMoreIcon"]');
        await page.click('.MuiButtonBase-root:nth-child(2) [data-testid="ExpandMoreIcon"]');

        // Click on <button> "Reports"
        await page.waitForSelector('.MuiButtonBase-root:nth-child(1) > .MuiBox-root > .MuiTypography-root');
        await Promise.all([
            page.click('.MuiButtonBase-root:nth-child(1) > .MuiBox-root > .MuiTypography-root'),
            page.waitForNavigation()
        ]);

        // Click on <a> "All Departments "
        await page.waitForSelector('#reports-category-selector > .text-nowrap');
        await page.click('#reports-category-selector > .text-nowrap');

        // Click on <a> "Code Enforcement"
        await page.waitForSelector('.dropdown-menu > li:nth-child(4) > a');
        await Promise.all([
            page.click('.dropdown-menu > li:nth-child(4) > a'),
            page.waitForNavigation()
        ]);

        // 2. Loop through each report
        for (const selector of reportSelectors) {
            try {
                console.log(`\nTriggering export for: ${selector}`);

                // --- Step A: Navigate to the Report Page ---
                await page.waitForSelector(selector, { visible: true });
                await Promise.all([
                    page.click(selector),
                    page.waitForNavigation({ waitUntil: 'networkidle2' }) // Ensure page loads fully
                ]);

                // --- Step B: Open Actions Menu ---
                console.log('   Clicking "Actions"...');
                await page.waitForSelector('.m-t--10', { visible: true });
                await page.click('.m-t--10');

                // --- Step C: Click Export ---
                console.log('   Clicking "Export Report"...');
                // Wait specifically for the Export link to be clickable
                const exportSelector = '.btn-group li:nth-child(2) > a';
                await page.waitForSelector(exportSelector, { visible: true });
                await page.click(exportSelector);

                // --- Step D: Close the Modal ---
                console.log('   Closing confirmation modal...');
                const closeBtnSelector = '.modal-dialog:nth-child(2) .modal-footer > [aria-label="Close"]';
                
                // Wait for the modal to actually fade in
                await page.waitForSelector(closeBtnSelector, { visible: true });
                
                // Sometimes modals have an animation, a small pause helps ensure the click registers
                await new Promise(r => setTimeout(r, 500)); 
                await page.click(closeBtnSelector);

                console.log('   ✅ Export triggered successfully.');

            } catch (err) {
                console.error(`   ❌ Failed to trigger export for ${selector}:`, err.message);
                // Continue to the next item in the loop even if one fails
            }
        }

        console.log('All export triggers completed.');

        // Click on <button> "Actions"
        await page.waitForSelector('.m-t--10');
        await page.click('.m-t--10');

        // Click on <a> "Export Report"
        await page.waitForSelector('.btn-group li:nth-child(2) > a');
        await page.click('.btn-group li:nth-child(2) > a');

        // Click on <button> "Close"
        await page.waitForSelector('.modal-dialog:nth-child(2) .modal-footer > [aria-label="Close"]');
        await page.click('.modal-dialog:nth-child(2) .modal-footer > [aria-label="Close"]');

        // Click on <div> .btn-icon
        await page.waitForSelector('.btn-icon');
        await page.click('.btn-icon');

        await new Promise(resolve => setTimeout(resolve, 20000));

        // Click on <a> "My Exports"
        await page.waitForSelector('[href="#"]');
        await Promise.all([
            page.click('[href="#"]'),
            page.waitForNavigation()
        ]);

        // Run the smart downloader
        await downloadLatestReports(page);

        await browser.close();

        // Return the path to the folder so the next script knows where to look
        return downloadPath; 

    } catch (error) {
        console.error('An error occurred during download:', error);
        // Throw the error so the main script can catch it
        throw error; 
    } finally {
        await browser.close();
        console.log('Browser closed.');
    }
}