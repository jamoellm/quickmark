function testRegExp(regex, string) {
  return regex.test(`^${string}$`);
}

function testRegExps(regexes, string) {
  return regexes.some((regex) => testRegExp(regex, string));
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function getPatternGroup(pattern, storageAPI) {
  const allGroups = await storageAPI.local.get("groups");
  const allPatterns = await storageAPI.local.get("patterns");

  const groupId = allGroups.groups[pattern] || null;
  if (groupId == null) {
    return [pattern];
  }
  const filteredPatterns = allPatterns.patterns.filter((pat) => {
    const id = allGroups.groups[pat] || null;
    if (id != null) {
      return id === groupId;
    }
    return false;
  });

  return filteredPatterns;
}

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
  let savedGroups = (await storageAPI.local.get("groups")).groups || [];

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
    const newPattern = patternInput.value.trim();
    if (!newPattern) return;

    if (savedPatterns.includes(newPattern)) {
      statusEl.textContent = "Pattern already exists.";
      return;
    }

    const regex = new RegExp(newPattern);
    console.log("Testing regex:", regex, "against URL:", currentUrl);

    if (!testRegExp(regex, currentUrl)) {
      statusEl.textContent =
        "Pattern does not match the current URL.\n\nPlease refer to the JS documentation for valid regex patterns.";
      return;
    }

    savedPatterns.push(newPattern);
    savedGroups[newPattern] = null;
    await storageAPI.local.set({
      patterns: savedPatterns,
      groups: savedGroups,
    });

    renderPatternList();
    statusEl.textContent = "Pattern saved!";
    await updateMatchingBookmark(newPattern, currentUrl);
  });

  function renderPatternList() {
    patternListEl.innerHTML = "";

    if (savedPatterns.length === 0) {
      patternListEl.innerHTML =
        '<li style="color: #777;">No Patterns saved.</li>';
      return;
    }

    savedPatterns
      .sort((a, b) => {
        const nameA = savedGroups[a] ? `${savedGroups[a]} - ${a}` : a;
        const nameB = savedGroups[b] ? `${savedGroups[b]} - ${b}` : b;

        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
      })
      .forEach((pattern, index) => {
        const li = document.createElement("li");

        const inputsDiv = document.createElement("div");
        inputsDiv.className = "inputs";

        const patternInput = document.createElement("input");
        patternInput.type = "text";
        patternInput.value = pattern;
        patternInput.placeholder = "URL Pattern (Regex)";

        const groupInput = document.createElement("input");
        groupInput.type = "text";
        groupInput.value = savedGroups[pattern] || "";
        groupInput.placeholder = "Group Id";

        inputsDiv.appendChild(patternInput);
        inputsDiv.appendChild(groupInput);

        ////////////////////////////////////////////////////

        const actionsDiv = document.createElement("div");
        actionsDiv.className = "actions";

        const btnSave = document.createElement("button");
        btnSave.textContent = "✓";
        btnSave.className = "btn-save";
            btnSave.title = "Save changes";
        btnSave.addEventListener("click", () =>
          updatePattern(index, patternInput.value, groupInput.value),
        );

        const btnDelete = document.createElement("button");
        btnDelete.textContent = "✕";
        btnDelete.className = "btn-delete";
        btnDelete.title = "Delete";
        btnDelete.addEventListener("click", () =>
          deletePattern(index, pattern),
        );

        actionsDiv.appendChild(btnSave);
        actionsDiv.appendChild(btnDelete);

        li.appendChild(inputsDiv);
        li.appendChild(actionsDiv);
        patternListEl.appendChild(li);
      });
  }

  async function updatePattern(index, newValue, newGroup) {
    const trimmed = newValue.trim();
    if (!trimmed) return;

    savedPatterns[index] = trimmed;
    savedGroups[trimmed] = newGroup || null;
    await storageAPI.local.set({
      patterns: savedPatterns,
      groups: savedGroups,
    });
    renderPatternList();
    statusEl.textContent = "Pattern updated!";
  }

  async function deletePattern(index, oldPattern) {
    savedPatterns.splice(index, 1);
    delete savedGroups[oldPattern];
    await storageAPI.local.set({
      patterns: savedPatterns,
      groups: savedGroups,
    });
    renderPatternList();
    statusEl.textContent = "Pattern deleted!";
  }

  async function updateMatchingBookmark(patternStr, newUrl) {
    let regex;
    try {
      regex = new RegExp(patternStr);
    } catch (e) {
      statusEl.textContent = "Invalid Regex Pattern!";
      return;
    }

    let bookmarks = await browser.bookmarks.search({});
    quickmarkFolder = bookmarks.find(
      (b) => b.title.toLowerCase() === "quickmark",
    );
    bookmarks = bookmarks.filter((b) => b.parentId === quickmarkFolder.id);

    const relevantPatterns = await getPatternGroup(patternStr, storageAPI);
    const relevantRegexes = relevantPatterns.map((pat) => new RegExp(pat));
    const targetBookmark = bookmarks.filter(
      (b) => b.url && testRegExps(relevantRegexes, b.url),
    );

    if (targetBookmark.length > 1) {
      statusEl.textContent =
        "Warning: The pattern's group matches multiple bookmarks.";
      return;
    } else if (targetBookmark.length == 1) {
      await browser.bookmarks.update(targetBookmark[0].id, { url: newUrl });
      statusEl.textContent = "Bookmark successfully updated!";
      setupForm.classList.add("hidden");
    } else {
      statusEl.textContent = "Pattern's group matches, but no bookmark found.";
    }
  }
});
