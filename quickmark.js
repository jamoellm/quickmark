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

const UNGROUPED = "No Group";
const ACCORDION_STATE_KEY = "accordionState";

async function readAccordionState(storageAPI) {
  const data = await storageAPI.local.get(ACCORDION_STATE_KEY);
  return data[ACCORDION_STATE_KEY] || {};
}

async function saveAccordionState(storageAPI, state) {
  await storageAPI.local.set({ [ACCORDION_STATE_KEY]: state });
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

  insertPattern = async () => {
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
  };

  saveBtn.addEventListener("click", insertPattern);
  patternInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      insertPattern();
    }
  });

  async function renderPatternList() {
    patternListEl.innerHTML = "";

    if (savedPatterns.length === 0) {
      patternListEl.innerHTML =
        '<li style="color: #777;">No Patterns saved.</li>';
      return;
    }

    const sortedPatterns = savedPatterns.sort((a, b) => {
      const nameA = savedGroups[a]
        ? `${savedGroups[a]} - ${a}`
        : "zzzzzzzzzz" + a;
      const nameB = savedGroups[b]
        ? `${savedGroups[b]} - ${b}`
        : "zzzzzzzzzz" + b;

      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return 0;
    });

    const groupedPatterns = Object.groupBy(
      sortedPatterns,
      (pattern) => savedGroups[pattern] || UNGROUPED,
    );

    const accordionState = await readAccordionState(storageAPI);

    Object.values(groupedPatterns).forEach((patterns) => {
      const groupId = savedGroups[patterns[0]] || UNGROUPED;

      const groupDiv = document.createElement("div");
      groupDiv.className = "group-box";
      patternListEl.appendChild(groupDiv);

      const groupHeader = document.createElement("div");
      groupHeader.className = "group-header";
      groupDiv.appendChild(groupHeader);
      if (groupId !== Object.keys(groupedPatterns)[0]) {
        groupHeader.classList.add("gets-line");
      }

      const accordeonButton = document.createElement("button");
      accordeonButton.className = "accordeon";
      groupHeader.appendChild(accordeonButton);

      const groupTitle = document.createElement("strong");
      groupTitle.textContent = groupId;
      groupTitle.classList.add("text-left");
      accordeonButton.appendChild(groupTitle);

      const accordeonIcon = document.createElement("span");
      accordeonIcon.className = "accordeon-icon";
      accordeonIcon.classList.add("text-right");
      accordeonIcon.textContent = "▼";
      accordeonButton.appendChild(accordeonIcon);

      const groupBody = document.createElement("div");
      groupBody.className = "group-body";
      groupDiv.appendChild(groupBody);

      const isCollapsed = !!accordionState[groupId];
      if (isCollapsed) {
        groupBody.classList.add("hidden");
        accordeonIcon.textContent = "◄";
      }

      patterns.forEach((pattern) => {
        const index = savedPatterns.indexOf(pattern);
        const li = document.createElement("li");

        const inputsDiv = document.createElement("div");
        inputsDiv.className = "inputs";

        const patternInput = document.createElement("input");
        patternInput.type = "text";
        patternInput.value = pattern;
        patternInput.placeholder = "URL Pattern (Regex)";
        patternInput.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            updatePattern(index, patternInput.value, groupInput.value);
          }
        });

        const groupInput = document.createElement("input");
        groupInput.type = "text";
        groupInput.value = savedGroups[pattern] || "";
        groupInput.placeholder = "Group Id";
        groupInput.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            updatePattern(index, patternInput.value, groupInput.value);
          }
        });

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

        ////////////////////////////////////////////////////

        li.appendChild(inputsDiv);
        li.appendChild(actionsDiv);
        groupBody.appendChild(li);
      });
    });

    const accordeonButtons = document.querySelectorAll(
      ".group-header button.accordeon",
    );
    for (let i = 0; i < accordeonButtons.length; i++) {
      accordeonButtons[i].addEventListener("click", async function () {
        const panel = this.parentElement.nextElementSibling;
        const isHidden = panel.classList.toggle("hidden");

        const icon = this.querySelector(".text-right");
        if (icon) {
          icon.textContent = isHidden ? "◄" : "▼";
        }

        const groupName =
          this.querySelector("strong")?.textContent || UNGROUPED;
        const accordionState = await readAccordionState(storageAPI);
        accordionState[groupName] = isHidden;
        await saveAccordionState(storageAPI, accordionState);
      });
    }
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
