function extractJobContent() {
	// Try to find common job posting containers
	const selectors = [
	  // LinkedIn
	  '.jobs-description',
	  // Indeed
	  '#jobDescriptionText',
	  // Glassdoor
	  '.jobDescriptionContent',
	  // General fallbacks
	  '[class*="job-description"]',
	  '[class*="description"]',
	  'article',
	  'main'
	];
  
	let content = '';
	
	for (const selector of selectors) {
	  const element = document.querySelector(selector);
	  if (element) {
		content = element.textContent;
		break;
	  }
	}
  
	if (!content) {
	  content = document.body.textContent;
	}
  
	// Clean up the text
	return content
	  .replace(/\s+/g, ' ')
	  .replace(/\n+/g, '\n')
	  .trim();
  }
  
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	console.log('Message received:', request);
	if (request.action === 'getJobContent') {
		console.log('Extracting job content...');
		sendResponse({ content: extractJobContent() });
	} else {
		console.log('Unknown action:', request.action);
	}
});