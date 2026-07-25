document.addEventListener('DOMContentLoaded', async () => {
    const statusEl = document.getElementById('status');
    const setupForm = document.getElementById('setup-form');
    const urlInput = document.getElementById('url');
    const patternInput = document.getElementById('pattern');
    const saveBtn = document.getElementById('save-btn');
    const patternListEl = document.getElementById('pattern-list');

    if (!urlInput || !patternInput || !saveBtn || !statusEl || !setupForm) {
        console.log("One or more elements not found in the DOM.");
        return;
    }

    const storageAPI = (typeof browser !== "undefined" && browser.storage) ? browser.storage : chrome.storage;

    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    const currentUrl = tab ? tab.url : "";
    if (urlInput) {
        urlInput.value = currentUrl
        patternInput.value = escapeRegExp(currentUrl);
    };

    const data = await storageAPI.local.get('patterns');
    let savedPatterns = data.patterns || [];

    renderPatternList();

    // get first pattern that matches the current URL
    const matchedPattern = savedPatterns.find(p => {
      try { return new RegExp(p).test(currentUrl); } catch(e) { return false; }
    });

    if (matchedPattern) {
      statusEl.textContent = "Pattern erkannt! Suche Bookmark...";
      await updateMatchingBookmark(matchedPattern, currentUrl);
    } else {
      statusEl.textContent = "Kein passendes Pattern gefunden.";
      setupForm.classList.remove('hidden');
    }

    saveBtn.addEventListener('click', async () => {
      const newPattern = patternInput.value.trim();
      if (!newPattern) return;


      if (savedPatterns.includes(newPattern)) {
        statusEl.textContent = "Pattern existiert bereits!";
        return;
      }

      const regex = new RegExp(newPattern);
      if (!regex.test(currentUrl)) {
        statusEl.textContent = "Pattern matcht nicht mit der aktuellen URL!\nPlease refer to the JS documentation for valid regex patterns.";
        return;
      }

      savedPatterns.push(newPattern);
      await storageAPI.local.set({ patterns: savedPatterns });

      renderPatternList();
      statusEl.textContent = "Pattern gespeichert!";
      await updateMatchingBookmark(newPattern, currentUrl);
    });

    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function renderPatternList() {
      patternListEl.innerHTML = '';

      if (savedPatterns.length === 0) {
        patternListEl.innerHTML = '<li style="color: #777;">Keine Patterns gespeichert.</li>';
        return;
      }

      savedPatterns.forEach((pattern, index) => {
        const li = document.createElement('li');

        // Editierbares Eingabefeld für das Pattern
        const input = document.createElement('input');
        input.type = 'text';
        input.value = pattern;

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'actions';

        // Speichern/Bearbeiten Button
        const btnSave = document.createElement('button');
        btnSave.textContent = '✓';
        btnSave.className = 'btn-save';
        btnSave.title = 'Änderung speichern';
        btnSave.addEventListener('click', () => updatePattern(index, input.value));

        // Löschen Button
        const btnDelete = document.createElement('button');
        btnDelete.textContent = '✕';
        btnDelete.className = 'btn-delete';
        btnDelete.title = 'Löschen';
        btnDelete.addEventListener('click', () => deletePattern(index));

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
      statusEl.textContent = "Pattern aktualisiert!";
    }

    async function deletePattern(index) {
      savedPatterns.splice(index, 1);
      await storageAPI.local.set({ patterns: savedPatterns });
      renderPatternList();
      statusEl.textContent = "Pattern gelöscht!";
    }

    async function updateMatchingBookmark(patternStr, newUrl) {
      try {
        const regex = new RegExp(patternStr);
        let bookmarks = await browser.bookmarks.search({});

        quickmarkFolder = bookmarks.find(b => b.title.toLowerCase() === "quickmark");
        bookmarks = bookmarks.filter(b => b.parentId === quickmarkFolder.id);

        const targetBookmark = bookmarks.filter(b => b.url && regex.test(b.url));

        if (targetBookmark.length > 1) {
            statusEl.textContent = "Warning: The pattern matches multiple bookmarks.";
            return;
        } else if (targetBookmark.length == 1) {
          await browser.bookmarks.update(targetBookmark[0].id, { url: newUrl });
          statusEl.textContent = "Bookmark erfolgreich aktualisiert!";
          setupForm.classList.add('hidden');
        } else {
          statusEl.textContent = "Pattern matcht, aber kein Bookmark gefunden.";
        }
      } catch (e) {
        statusEl.textContent = "Ungültiges Regex-Pattern!";
      }
    }
});