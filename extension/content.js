// content.js is injected into Facebook Marketplace whenever the url matches the create route.

chrome.storage.local.get(["pendingListing"], (result) => {
  const listing = result.pendingListing;
  
  if (listing) {
    console.log("[Content Script] Found pending Sealift payload:", listing);
    chrome.storage.local.remove("pendingListing"); // Clear immediately

    // Start polling since Facebook's React app takes an unpredictable amount of time to render
    startPollingForForm(listing);
  }
});

function startPollingForForm(listing) {
  let attempts = 0;
  const maxAttempts = 30; // 15 seconds max

  const poller = setInterval(() => {
    attempts++;
    console.log(`[Content Script] Polling for Facebook DOM elements... Attempt ${attempts}`);

    // Find inputs dynamically based on the visual text that appears near them
    const titleInput = findInputByLabelText("Title");
    const priceInput = findInputByLabelText("Price");
    const descInput = findInputByLabelText("Description");

    if (titleInput) {
      clearInterval(poller);
      console.log("[Content Script] Form detected! Beginning population...");

      if (listing.title && titleInput) setReactNativeValue(titleInput, listing.title);
      if (listing.price && priceInput) setReactNativeValue(priceInput, listing.price);
      if (listing.description && descInput) setReactNativeValue(descInput, listing.description);

      console.log("[Content Script] Form population sequence completed.");
    } else if (attempts >= maxAttempts) {
      clearInterval(poller);
      console.error("[Content Script] Form never appeared. Facebook may have changed their DOM structure.");
    }
  }, 500);
}

// Bypasses obfuscation by scanning the DOM for specific text, then grabbing the nearest input box
function findInputByLabelText(labelText) {
  // 1. Direct standard checks (fastest)
  const directInput = document.querySelector(`input[aria-label="${labelText}"], textarea[aria-label="${labelText}"]`);
  if (directInput) return directInput;

  // 2. Scan all wrappers that might contain the text (e.g. <span>Title</span> <input... />)
  const allElements = Array.from(document.querySelectorAll('label, span, div'));
  for (let el of allElements) {
    // Only check elements that have exactly this text (no children text bleeding)
    if (el.textContent.trim() === labelText && el.children.length === 0) {
      // Walk UP the DOM tree to find the grouping container, then look DOWN for the input
      let current = el.parentElement;
      for (let i = 0; i < 5; i++) {
        if (!current) break;
        const input = current.querySelector('input, textarea');
        if (input) return input;
        current = current.parentElement;
      }
    }
  }
  return null;
}

// React hijacks standard input events, so simply setting input.value = "foo" doesn't work.
function setReactNativeValue(inputElement, value) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;

  // Use the correct setter depending on if it's an input or textarea
  if (inputElement.tagName.toLowerCase() === 'textarea') {
    nativeTextAreaValueSetter.call(inputElement, value);
  } else {
    nativeInputValueSetter.call(inputElement, value);
  }
  
  // Dispatch multiple events just to be safe with React 18+
  inputElement.dispatchEvent(new Event('input', { bubbles: true }));
  inputElement.dispatchEvent(new Event('change', { bubbles: true }));
}
