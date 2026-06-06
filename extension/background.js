// background.js runs permanently in the Chrome background (Service Worker)

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "OPEN_FACEBOOK") {
    // 1. Temporarily save the cross-posting payload to Chrome's local storage
    chrome.storage.local.set({ pendingListing: request.payload }, () => {
      
      // 2. Open the Facebook Marketplace creation page in a new foreground tab
      chrome.tabs.create({ url: "https://www.facebook.com/marketplace/create/item" });
      
      // 3. Let Sealift know we are executing
      sendResponse({ status: "success" });
    });
    
    // Return true to keep the message channel open for the async set() operation
    return true; 
  }
});
