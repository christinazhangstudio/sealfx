// bridge.js injects into the Sealift Next.js app
// It listens for a custom window message emitted when the user clicks "Approve & Crosslist"

window.addEventListener("message", (event) => {
  // Security check: Only accept messages from the same window
  if (event.source !== window || !event.data) return;

  // Listen for our specific trigger
  if (event.data.type === "SEALIFT_CROSSLIST_REQUEST") {
    console.log("[Bridge] Intercepted payload from Next.js:", event.data.payload);

    // Forward the message to the background service worker
    chrome.runtime.sendMessage(
      { action: "OPEN_FACEBOOK", payload: event.data.payload },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("[Bridge] Extension connection error:", chrome.runtime.lastError);
        } else {
          console.log("[Bridge] Extension acknowledged trigger:", response);
        }
      }
    );
  }
});
