// /reportDownloader.js

// Make sure to import everything this file needs
import 'dotenv/config';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

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

        // Click on <a> "Z Housing Enforcement 1"
        await page.waitForSelector('#reports-menu-records-z-housing-enforcement-1');
        await Promise.all([
            page.click('#reports-menu-records-z-housing-enforcement-1'),
            page.waitForNavigation()
        ]);

        // Click on <button> "Actions"
        await page.waitForSelector('.m-t--10');
        await page.click('.m-t--10');

        // Click on <a> "Export Report"
        await page.waitForSelector('.btn-group li:nth-child(2) > a');
        await page.click('.btn-group li:nth-child(2) > a');

        // Click on <button> "Close"
        await page.waitForSelector('.modal-dialog:nth-child(2) .modal-footer > [aria-label="Close"]');
        await page.click('.modal-dialog:nth-child(2) .modal-footer > [aria-label="Close"]');

        // Click on <a> "z Housing Enforcement 2"
        await page.waitForSelector('#reports-menu-records-z-housing-enforcement-2');
        await Promise.all([
            page.click('#reports-menu-records-z-housing-enforcement-2'),
            page.waitForNavigation()
        ]);

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

        // Click on <a> "Download"
        await page.waitForSelector('tr:nth-child(2) .btn');
        await page.click('tr:nth-child(2) .btn');
        console.log('Download triggered. Waiting 15 seconds...');
        await page.waitForNetworkIdle({
            idleTime: 5000,  // Time in ms to wait for no new network requests
            timeout: 60000   // Max time to wait (60 seconds)
        });
        console.log('Download complete (assumed).');

        // Click on <a> "Download"
        await page.waitForSelector('tr:nth-child(3) .btn');
        await page.click('tr:nth-child(3) .btn');
        console.log('Download triggered. Waiting 15 seconds...');
        await page.waitForNetworkIdle({
            idleTime: 5000,  // Time in ms to wait for no new network requests
            timeout: 60000   // Max time to wait (60 seconds)
        });
        console.log('Download complete (assumed).');

        await browser.close();

        // Return the path to the folder so the next script knows where to look
        // return downloadPath; 

    } catch (error) {
        console.error('An error occurred during download:', error);
        // Throw the error so the main script can catch it
        throw error; 
    } finally {
        await browser.close();
        console.log('Browser closed.');
    }
}