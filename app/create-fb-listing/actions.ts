"use server";

export async function generateListingDescription(base64Image: string, mimeType: string) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  if (!apiKey) {
    // Fallback if no API key is set so the app still functions
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate delay
    return "This is a great item in excellent condition. Perfect for anyone looking for good quality at a reasonable price! (Note: Set GEMINI_API_KEY in .env to use actual AI vision).";
  }

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: "Act as an expert salesperson writing a Facebook Marketplace listing. Return only the description text without any markdown or extra conversational formatting. Keep it under 1 paragraphs." },
            { inlineData: { mimeType, data: base64Image } }
          ]
        }]
      })
    });

    if (!res.ok) {
      throw new Error(`API call failed: ${res.statusText} ${await res.text()}`);
    }

    const data = await res.json();
    const aiText = data.candidates[0].content.parts[0].text.trim();

    // Hardcode any custom text you want to append to every listing here:
    const hardcodedFooter = "\n\n📍 Pickup only in Richmond/Sugar Land, 77469";

    return aiText + hardcodedFooter;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return "Failed to generate description. Please check the API key and try again.";
  }
}
