document.addEventListener("DOMContentLoaded", () => {
  const goButton = document.getElementById("go-button");
  const downloadButton = document.getElementById("download-button");
  const stopButton = document.getElementById("stop-button");

  // Ensure we start in a "do nothing" state unless user clicks Go
  chrome.storage.local.set({ goFlag: false, stopFlag: false });

  // 1) "Go" button
  goButton.addEventListener("click", () => {
    // Clear old data if we want a fresh start
    chrome.storage.local.clear(() => {
      // Then set goFlag to true
      chrome.storage.local.set({ goFlag: true, stopFlag: false }, () => {
        console.log("Go button pressed. goFlag=true. Navigating...");
        // Now navigate in current tab
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.update(tabs[0].id, {
              url: "https://www.linkedin.com/mynetwork/invite-connect/connections/"
            });
          }
        });
      });
    });
  });

  // 2) "Stop" button
  stopButton.addEventListener("click", () => {
    // Set flags to false to forcibly stop
    chrome.storage.local.set({ goFlag: false, stopFlag: true }, () => {
      console.log("Stop clicked. goFlag=false, stopFlag=true.");
    });
  });

  // 3) Check if we have scraped connections
  chrome.storage.local.get(["linkedinConnections", "ownerData"], (data) => {
    const connections = data.linkedinConnections || [];
    const owner = data.ownerData || {};

    console.log("Owner data (not in CSV):", owner);

    if (connections.length > 0) {
      downloadButton.style.display = "inline-block";
      downloadButton.textContent = `Download (${connections.length})`;

      downloadButton.addEventListener("click", () => {
        const csvContent = generateCSV(connections);
        downloadCSV(csvContent, "connections.csv");
      });
    }
  });
});

function generateCSV(profiles) {
  let csv = "Name,Headline,ProfileUrl,ImageUrl,ConnectedTime,OpenToWork,Hiring\n";
  profiles.forEach(profile => {
    const row = [
      profile.name || "",
      profile.headline || "",
      profile.profileUrl || "",
      profile.imageUrl || "",
      profile.connectedTime || "",
      profile.isOpenToWork || "",
      profile.isHiring || ""
    ].map(field => `"${field.replace(/"/g, '""')}"`).join(",");
    csv += row + "\n";
  });
  return csv;
}

function downloadCSV(csvContent, filename) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
