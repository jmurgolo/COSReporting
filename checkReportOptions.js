// === CONFIGURATION ===
// ID of the checkbox you want to start WITH.
const startElementId = "1_reportable_checkbox";

// Text of the heading (<h5>) you want to stop BEFORE.
const endElementText = "Certified Letters";

// Pause time in milliseconds (1000 = 1 second)
const delayInMilliseconds = 1500;
// =====================


// --- Helper function for pausing ---
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// --- Main script logic ---
async function clickCheckboxesById() {
    // 1. Find the start and end elements
    const startElement = document.getElementById(startElementId);
    const endElement = Array.from(document.querySelectorAll('h5')).find(h => h.textContent.trim().includes(endElementText));

    // --- Error Checking ---
    if (!startElement) {
        console.error(`Error: Could not find a start element with ID "${startElementId}". Please check the ID.`);
        return;
    }
    if (!endElement) {
        console.error(`Error: Could not find an end element with text "${endElementText}". Please check the text.`);
        return;
    }

    console.log('Found start element (by ID):', startElement);
    console.log('Found end element (by text):', endElement);

    // 2. Find all checkboxes
    const allCheckboxes = document.querySelectorAll('input[type="checkbox"]');
    const boxesToClick = [];

    // 3. Filter only the checkboxes in our range
    allCheckboxes.forEach(checkbox => {
        // Check if the box is the start element OR is after it
        const isSameAsStart = startElement.isSameNode(checkbox);
        const isAfterStart = startElement.compareDocumentPosition(checkbox) & Node.DOCUMENT_POSITION_FOLLOWING;

        // Check if the box is before the end element
        const isBeforeEnd = endElement.compareDocumentPosition(checkbox) & Node.DOCUMENT_POSITION_PRECEDING;

        // Condition: (Is the start element OR is after it) AND is before the end element
        if ((isSameAsStart || isAfterStart) && isBeforeEnd) {
            boxesToClick.push(checkbox);
        }
    });

    if (boxesToClick.length === 0) {
        console.warn(`No checkboxes found between ID "${startElementId}" and text "${endElementText}".`);
        return;
    }

    console.log(`Found ${boxesToClick.length} checkboxes to click. Starting now...`);

    // 4. Loop through and click each box one by one
    for (let i = 0; i < boxesToClick.length; i++) {
        const checkbox = boxesToClick[i];
        
        const label = checkbox.closest('label');
        const labelText = label ? label.textContent.trim() : `(No label text found)`;

        console.log(`Clicking box ${i + 1} of ${boxesToClick.length}: "${labelText}"`);
        
        // This simulates a real user click
        checkbox.click(); 

        // Wait for the specified delay
        await sleep(delayInMilliseconds);
    }

    console.log('--- All done! ---');
}

// Run the function
clickCheckboxesById();