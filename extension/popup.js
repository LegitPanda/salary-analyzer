let jobContent = "";
const APIKEY = ""

function afterDOMLoaded() {
	const analyzeButton = document.getElementById("analyze");
	if (!analyzeButton) {
		console.error("Analyze button not found");
		return;
	}

	analyzeButton.addEventListener("click", async () => {
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

			jobContentDiv.textContent = jobContent;
			contentSection.style.display = "block";

			// Start the analysis
			analysisSection.style.display = "block";
			analysisDiv.textContent = "";
			const prompt = `Based on the following job posting, analyze the expected salary range. 
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
4. Market context and considerations`;

			apiOutputToDiv(prompt, analysisDiv);
		} catch (err) {
			errorDiv.textContent = `Failed to analyze job posting. Please try again. ${err.toString()}`;
			errorDiv.style.display = "block";
		}
	});
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", afterDOMLoaded);
} else {
	afterDOMLoaded();
}

const apiOutputToDiv = async (prompt, div) => {
	div.textContent = "";

	const apiResponse = await fetch(
		`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?alt=sse&key=${APIKEY}`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				contents: [
					{
						parts: [{ text: prompt }],
					},
				],
			}),
		},
	);

	const reader = apiResponse.body
		?.pipeThrough(new TextDecoderStream())
		.getReader();

	if (!reader) {
		console.log("no reader :(");
	}

	while (true) {
		const { value, done } = await reader.read();
		if (done) break;
		let dataDone = false;
		const arr = value.split("\n");
		for (const data of arr) {
			if (data.length < 6) continue; // ignore empty message
			if (data.startsWith(":")) continue; // ignore sse comment message
			if (data === "data: [DONE]") {
				dataDone = true;
				break;
			}
			const json = JSON.parse(data.substring(6));
			const newText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
			if (newText) {
				div.textContent += newText;
			}

			console.log({ data, json, newText, text: div.textContent });
		}
		if (dataDone) {
			console.log("done");
			break;
		}
	}
};
