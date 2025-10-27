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

    const browser = await puppeteer.launch({ headless: false });

    try {
        const page = await browser.newPage();
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

``


        console.log('Download triggered. Waiting 15 seconds...');
        await new Promise(resolve => setTimeout(resolve, 15000));
        
        console.log('Download complete (assumed).');

        // *** This is the new, important part ***
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