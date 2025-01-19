let jobContent = "";
let streaming = false;

function afterDOMLoaded() {

	const analyzeButton = document.getElementById("analyze");
	if (!analyzeButton) {
		console.error("Analyze button not found");
		return;
	}
  
	analyzeButton.addEventListener("click", async () => {
		console.log("Analyze button clicked"); // Log when the button is clicked
		const errorDiv = document.getElementById("error");
		const contentSection = document.getElementById("content-section");
		const analysisSection = document.getElementById("analysis-section");
		const jobContentDiv = document.getElementById("job-content");
		const analysisDiv = document.getElementById("analysis");

		errorDiv.style.display = "none";

		try {
			console.log("Getting active tab...");
			const [tab] = await chrome.tabs.query({
				active: true,
				currentWindow: true,
			});

			if (!tab) {
				console.error("No active tab found");
				return;
			}

			console.log("Sending message to content script..."); // Log before sending message
			// Get job content from the page
			const response = await chrome.tabs.sendMessage(tab.id, {
				action: "getJobContent",
			});
			jobContent = response.content;

			console.log({ jobContent });

			// Display the job content
			jobContentDiv.textContent = jobContent;
			contentSection.style.display = "block";

			// Start the analysis
			analysisSection.style.display = "block";
			analysisDiv.textContent = "";
			streaming = true;

			// Create the analysis prompt
			const prompt = `
        Based on the following job posting, analyze the expected salary range. 
        Consider factors like:
        - Required experience level
        - Technical skills required
        - Job location (if mentioned)
        - Company size/industry
        - Job responsibilities
        - Similar market rates
        
        Job Posting:
        ${jobContent}

        Provide a detailed salary analysis with:
        1. Estimated salary range
        2. Factors that influenced this estimate
        3. Level of confidence in the estimate
        4. Market context and considerations
      `;

			console.log("calling openai API");
			// Call OpenAI API
			const apiResponse = await fetch(
				"https://api.openai.com/v1/chat/completions",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: "Bearer {YOUR KEY HERE}",
					},
					body: JSON.stringify({
						model: "gpt-3.5-turbo",
						messages: [
							{
								role: "user",
								content: prompt,
							},
						],
						stream: true,
					}),
				},
			);

			console.log("API Response Status:", apiResponse.status);
			const responseBody = await apiResponse.text();
			console.log("API Response Body:", responseBody);

			if (!apiResponse.ok) throw new Error(`Failed to analyze salary: ${responseBody}`);

			const reader = apiResponse.body.getReader();
			const decoder = new TextDecoder();

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const chunk = decoder.decode(value);
				const lines = chunk.split("\n");
				const parsedLines = lines
					.map((line) => line.replace(/^data: /, "").trim())
					.filter((line) => line !== "" && line !== "[DONE]")
					.map((line) => {
						try {
							return JSON.parse(line);
						} catch {
							return null;
						}
					})
					.filter(Boolean);

				for (const parsed of parsedLines) {
					if (parsed.choices[0].delta.content) {
						analysisDiv.textContent += parsed.choices[0].delta.content;
					}
				}
			}
		} catch (err) {
			errorDiv.textContent = `Failed to analyze job posting. Please try again. ${err.toString()}`;
			errorDiv.style.display = "block";
		} finally {
			streaming = false;
		}
	});
};

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", afterDOMLoaded);
} else {
	afterDOMLoaded();
}