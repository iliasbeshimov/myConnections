// connections.js
(function runConnections() {
  // 1) Ensure we are on the correct page
  if (!location.href.includes("/mynetwork/invite-connect/connections")) {
    console.log("connections.js: Not on the connections page, do nothing.");
    return;
  }

  // 2) Delay or check doc state to ensure DOM is ready
  if (document.readyState === "loading") {
    // The page is still loading => wait for it to finish
    document.addEventListener("DOMContentLoaded", init);
  } else {
    // Page is ready => proceed
    init();
  }

  // On page unload => set goFlag=false so we don't auto-run if user returns manually
  window.addEventListener("beforeunload", () => {
    chrome.storage.local.set({ goFlag: false }, () => {
      console.log("Navigating away => goFlag=false.");
    });
  });

  async function init() {
    // 3) Check if user clicked "Go"
    const { goFlag } = await getFromStorage("goFlag");
    if (!goFlag) {
      console.log("connections.js: goFlag=false => no scraping.");
      return;
    }

    console.log("connections.js: goFlag=true, starting auto-scroll...");

    // If needed, optionally clear storage or do other setup
    // But typically we do that from the popup code

    await autoScrollConnections();

    const profilesData = extractConnectionData();
    chrome.storage.local.set({ linkedinConnections: profilesData }, () => {
      console.log("connections.js: Saved connections:", profilesData.length);
    });
  }
})();

/** autoScrollConnections checks if we should stop each iteration. */
async function autoScrollConnections() {
  let prevCount = 0;
  let attemptsWithNoNew = 0;
  const maxEmptyScrolls = 5;

  while (true) {
    // Check if we should stop
    if (await shouldStop()) {
      console.log("autoScrollConnections: Stopping loop (stopFlag or goFlag=false).");
      break;
    }

    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    await waitMs(randomBetween(2000, 3000));

    if (await shouldStop()) {
      console.log("Stopped after scroll (flag changed).");
      break;
    }

    const cards = document.querySelectorAll("li.mn-connection-card");
    const currentCount = cards.length;
    console.log(`Scrolled... found ${currentCount} connections so far.`);

    if (currentCount > prevCount) {
      prevCount = currentCount;
      attemptsWithNoNew = 0;
    } else {
      const didClick = await maybeClickShowMoreButton();
      if (didClick) {
        console.log("Clicked 'Show more results', waiting...");
        await waitMs(randomBetween(2000, 3000));

        if (await shouldStop()) {
          console.log("Stopped after showMore click (flag changed).");
          break;
        }

        const newCount = document.querySelectorAll("li.mn-connection-card").length;
        if (newCount > prevCount) {
          prevCount = newCount;
          attemptsWithNoNew = 0;
          continue;
        }
      }

      attemptsWithNoNew++;
      if (attemptsWithNoNew >= maxEmptyScrolls) {
        console.log("No more new connections, stopping auto-scroll.");
        break;
      }
    }
  }
}

async function maybeClickShowMoreButton() {
  let showMoreBtn = document.querySelector("button.scaffold-finite-scroll__load-button");
  if (!showMoreBtn) {
    // Fallback text search
    showMoreBtn = Array.from(document.querySelectorAll("button"))
      .find(btn => btn.textContent.trim().toLowerCase().includes("show more results"));
  }
  if (showMoreBtn) {
    showMoreBtn.scrollIntoView({ block: "center", behavior: "smooth" });
    await waitMs(1000);
    try {
      showMoreBtn.click();
      return true;
    } catch (e) {
      console.warn("Error clicking 'Show more results':", e);
    }
  }
  return false;
}

function extractConnectionData() {
  const profiles = [];
  document.querySelectorAll("li.mn-connection-card").forEach(card => {
    const nameEl = card.querySelector(".mn-connection-card__name");
    const name = nameEl ? nameEl.textContent.trim() : "";

    const occupationEl = card.querySelector(".mn-connection-card__occupation");
    const headline = occupationEl ? occupationEl.textContent.trim() : "";

    const linkEl = card.querySelector("a.mn-connection-card__link");
    let profileUrl = linkEl ? linkEl.getAttribute("href") : "";
    if (profileUrl && !profileUrl.startsWith("http")) {
      profileUrl = "https://www.linkedin.com" + profileUrl;
    }

    const imageEl = card.querySelector(".presence-entity__image");
    const imageUrl = imageEl ? imageEl.src : "";

    const timeEl = card.querySelector("time.time-badge");
    let connectedTime = timeEl ? timeEl.textContent.trim().replace("Connected", "").trim() : "";

    let isOpenToWork = "No";
    let isHiring = "No";
    if (imageEl) {
      const altText = (imageEl.alt || "").toLowerCase();
      if (altText.includes("is open to work")) {
        isOpenToWork = "Yes";
      }
      if (altText.includes("is hiring")) {
        isHiring = "Yes";
      }
    }

    profiles.push({
      name,
      headline,
      profileUrl,
      imageUrl,
      connectedTime,
      isOpenToWork,
      isHiring
    });
  });
  return profiles;
}

// We stop if user pressed "Stop" => stopFlag=true, or user navigated => goFlag=false
async function shouldStop() {
  const { goFlag, stopFlag } = await getFromStorage(["goFlag", "stopFlag"]);
  return stopFlag || !goFlag;
}

// ---------- HELPER UTILS ----------
function waitMs(ms) {
  return new Promise(res => setTimeout(res, ms));
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

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

/**
 * Wait for a specific element to appear in the DOM, if needed.
 * (We used it in user.js; here it's not strictly required. 
 * If you do need it for connections page, you can replicate the pattern from user.js)
 */
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
