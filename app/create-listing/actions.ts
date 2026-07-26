"use server";

// Returned to the page so failures render as errors instead of fake descriptions.
export interface GenerateListingResult {
  description?: string;
  error?: string;
}

export async function generateListingDescription(base64Image: string, mimeType: string): Promise<GenerateListingResult> {
  // Any OpenAI-compatible chat completions endpoint with vision support works here.
  // Same env vars as the sealift backend so one pair configures both apps.
  const url = process.env.SELF_HOSTED_AI_CHAT_COMPLETIONS_URL;
  const model = process.env.SELF_HOSTED_AI_CHAT_COMPLETIONS_MODEL;

  if (!url || !model) {
    // Fallback if no endpoint is configured so the app still functions
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate delay
    return { description: "This is a great item in excellent condition. Perfect for anyone looking for good quality at a reasonable price! (Note: Set SELF_HOSTED_AI_CHAT_COMPLETIONS_URL and SELF_HOSTED_AI_CHAT_COMPLETIONS_MODEL in .env to use actual AI vision)." };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Write a eBay style listing as simply as possible. No markdown or extra conversational formatting. Keep it under 50 words. Don't add shipping or price information." },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } }
            ]
          }
        ]
      })
    });

    if (!res.ok) {
      console.error(`AI API call failed: ${res.statusText} ${await res.text()}`);
      return { error: "The AI service returned an error. Try again in a moment." };
    }

    const data = await res.json();
    // Reasoning models may emit <think> blocks in content; drop them.
    const aiText = data.choices[0].message.content
      .replace(/<think>[\s\S]*?<\/think>/g, "")
      .trim();

    // Hardcode any custom text you want to append to every listing here:
    const hardcodedFooter = "\n\n📍 Pickup only in Richmond/Sugar Land, 77469";

    return { description: aiText + hardcodedFooter };
  } catch (error) {
    console.error("Error calling chat completions API:", error);
    return { error: "Could not reach the AI service. Try again in a moment." };
  }
}
