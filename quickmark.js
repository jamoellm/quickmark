document.addEventListener("DOMContentLoaded", async () => {
  const statusEl = document.getElementById("status");
  const setupForm = document.getElementById("setup-form");
  const urlInput = document.getElementById("url");
  const patternInput = document.getElementById("pattern");
  const saveBtn = document.getElementById("save-btn");
  const patternListEl = document.getElementById("pattern-list");

  if (!urlInput || !patternInput || !saveBtn || !statusEl || !setupForm) {
    console.log("One or more elements not found in the DOM.");
    return;
  }

  const storageAPI =
    typeof browser !== "undefined" && browser.storage
      ? browser.storage
      : chrome.storage;

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const currentUrl = tab ? tab.url : "";
  if (urlInput) {
    urlInput.value = currentUrl;
    patternInput.value = escapeRegExp(currentUrl);
  }

  const data = await storageAPI.local.get("patterns");
  let savedPatterns = data.patterns || [];

  renderPatternList();

  // get first pattern that matches the current URL
  const matchedPattern = savedPatterns.find((p) => {
    try {
      return testRegExp(new RegExp(p), currentUrl);
    } catch (e) {
      return false;
    }
  });

  if (matchedPattern) {
    statusEl.textContent = "Pattern recognized. Searching Bookmark...";
    await updateMatchingBookmark(matchedPattern, currentUrl);
  } else {
    statusEl.textContent = "No matching pattern found.";
    setupForm.classList.remove("hidden");
  }

  saveBtn.addEventListener("click", async () => {
    // test if there is a pattern
    const newPattern = patternInput.value.trim();
    if (!newPattern) return;

    // test if there is a _new_ pattern
    if (savedPatterns.includes(newPattern)) {
      statusEl.textContent = "Pattern already exists.";
      return;
    }

    // test if this pattern matches the current URL
    const regex = new RegExp(newPattern);
    if (!testRegExp(regex, currentUrl)) {
      statusEl.textContent =
        "Pattern does not match the current URL.\n\nPlease refer to the JS documentation for valid regex patterns.";
      return;
    }

    // test if there exists a bookmark that matches this pattern
    const bookmarkExists = await updateMatchingBookmark(newPattern, currentUrl);

    // if not, create new bookmark
    if (bookmarkExists === false) {
      const activeTab = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      const newBookmark = await browser.bookmarks.create({
        parentId: quickmarkFolder.id,
        title: activeTab[0].title || "New Bookmark",
        url: currentUrl,
      });
      // console.log("New bookmark created:", newBookmark);

      statusEl.textContent =
        "Pattern matches current URL, but no bookmark found.\n\nNew bookmark created.";
    }

    savedPatterns.push(newPattern);
    await storageAPI.local.set({ patterns: savedPatterns });

    renderPatternList();
    // statusEl.textContent = "Pattern saved!";
    // await updateMatchingBookmark(newPattern, currentUrl);
  });

  function testRegExp(regex, string) {
    return regex.test(`^${string}$`);
  }

  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function renderPatternList() {
    patternListEl.innerHTML = "";

    if (savedPatterns.length === 0) {
      patternListEl.innerHTML =
        '<li style="color: #777;">No Patterns saved.</li>';
      return;
    }

    savedPatterns.sort().forEach((pattern, index) => {
      const li = document.createElement("li");

      const input = document.createElement("input");
      input.type = "text";
      input.value = pattern;

      const actionsDiv = document.createElement("div");
      actionsDiv.className = "actions";

      const btnSave = document.createElement("button");
      btnSave.textContent = "✓";
      btnSave.className = "btn-save";
      btnSave.title = "Save changes";
      btnSave.addEventListener("click", () =>
        updatePattern(index, input.value),
      );

      const btnDelete = document.createElement("button");
      btnDelete.textContent = "✕";
      btnDelete.className = "btn-delete";
      btnDelete.title = "Delete";
      btnDelete.addEventListener("click", () => deletePattern(index));

      actionsDiv.appendChild(btnSave);
      actionsDiv.appendChild(btnDelete);

      li.appendChild(input);
      li.appendChild(actionsDiv);
      patternListEl.appendChild(li);
    });
  }

  async function updatePattern(index, newValue) {
    const trimmed = newValue.trim();
    if (!trimmed) return;

    savedPatterns[index] = trimmed;
    await storageAPI.local.set({ patterns: savedPatterns });
    renderPatternList();
    statusEl.textContent = "Pattern updated!";
  }

  async function deletePattern(index) {
    savedPatterns.splice(index, 1);
    await storageAPI.local.set({ patterns: savedPatterns });
    renderPatternList();
    statusEl.textContent = "Pattern deleted!";
  }

  async function updateMatchingBookmark(patternStr, newUrl) {
    try {
      const regex = new RegExp(patternStr);
      let bookmarks = await browser.bookmarks.search({});

      quickmarkFolder = bookmarks.find(
        (b) => b.title.toLowerCase() === "quickmark",
      );
      bookmarks = bookmarks.filter((b) => b.parentId === quickmarkFolder.id);

      const targetBookmark = bookmarks.filter(
        (b) => b.url && testRegExp(regex, b.url),
      );

      if (targetBookmark.length > 1) {
        statusEl.textContent =
          "Warning: The pattern matches multiple bookmarks.";
        return null;
      } else if (targetBookmark.length == 1) {
        await browser.bookmarks.update(targetBookmark[0].id, { url: newUrl });
        statusEl.textContent = "Bookmark successfully updated!";
        setupForm.classList.add("hidden");
        return true;
      } else {
        // TODO: Create appropriate bookmark?
        statusEl.textContent =
          "Pattern matches current URL, but no bookmark found.";
        return false;
      }
    } catch (e) {
      statusEl.textContent = "Invalid Regex Pattern!";
      return null;
    }
    return null;
  }
});
