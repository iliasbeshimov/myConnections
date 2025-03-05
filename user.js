// user.js
(async function() {
  // Check if user actually pressed "Go" (goFlag)
  const { goFlag } = await getFromStorage("goFlag");
  if (!goFlag) {
    console.log("user.js: goFlag=false, skipping owner data scraping.");
    return;
  }

  console.log("user.js: goFlag=true, proceeding with owner data scraping...");

  // Wait for the "Me" menu button
  const meButton = await waitForElement("button.global-nav__primary-link-me-menu-trigger");
  if (!meButton) {
    console.warn("No 'Me' menu button found. Cannot scrape user data.");
    return;
  }
  meButton.click();

  // Wait for the open dropdown container
  const dropdownContainer = await waitForElement(".artdeco-dropdown__content-inner");
  if (!dropdownContainer) {
    console.warn("Dropdown container not found. UI may have changed.");
    return;
  }

  // Parse fields
  let name = "";
  let profileUrl = "";
  let profilePic = "";
  let headline = "";
  let companyUrl = "";

  // a) main <img> with alt= name, src= pic
  const userImg = dropdownContainer.querySelector("img.global-nav__me-photo");
  if (userImg) {
    name = (userImg.alt || "").trim();
    profilePic = userImg.src || "";
  }

  // b) <a href="/in/..."> => profile URL
  const profileLink = dropdownContainer.querySelector("a[href^='/in/']");
  if (profileLink) {
    const hrefVal = profileLink.getAttribute("href") || "";
    profileUrl = hrefVal.startsWith("http")
      ? hrefVal
      : "https://www.linkedin.com" + hrefVal;
  }

  // c) Headline from .artdeco-entity-lockup__subtitle
  const headlineEl = dropdownContainer.querySelector(".artdeco-entity-lockup__subtitle");
  if (headlineEl) {
    headline = headlineEl.textContent.trim();
  }

  // d) Company link from a[href^='https://www.linkedin.com/company/']
  const companyLink = dropdownContainer.querySelector("a[href^='https://www.linkedin.com/company/']");
  if (companyLink) {
    companyUrl = companyLink.getAttribute("href") || "";
  }

  // Save
  const ownerData = { name, profileUrl, profilePic, headline, companyUrl };
  chrome.storage.local.set({ ownerData }, () => {
    console.log("user.js: Owner data saved:", ownerData);
  });

})();

// Helper: wait for element
function waitForElement(selector) {
  return new Promise(resolve => {
    const existing = document.querySelector(selector);
    if (existing) return resolve(existing);

    const observer = new MutationObserver(() => {
      const found = document.querySelector(selector);
      if (found) {
        observer.disconnect();
        resolve(found);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

// Helper: get local storage keys
function getFromStorage(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (res) => {
      if (typeof keys === "string") {
        resolve({ [keys]: res[keys] });
      } else {
        resolve(res);
      }
    });
  });
}
