# Quickmark 🔖

> **Bookmark Pattern Updater for Firefox**

A lightweight Firefox extension designed for websites that don't automatically remember where you left off. With **Quickmark**, you can quickly and easily update your reading or watching progress directly in your bookmarks with a single click.

Simply click the extension icon <img src="icon-32.png" style="height: 1.2em; vertical-align: middle;"> to start.

---

## 🚀 Features

* **Automatic Updates:** If the extension detects a saved URL pattern (Regex) on your current page, it instantly overwrites the matching bookmark with your new URL.
* **Pattern Management:** Easily create, edit, and delete custom URL patterns directly within the extension popup.
* **Smart Matching:** Works seamlessly with sequential URLs (e.g., page numbers, episode IDs, or chapter URLs).

---

## 💡 How It Works

1. **Initial Setup:**
   * Navigate to the website whose progress you want to track.
   * Click the extension icon <img src="icon-32.png" style="height: 1.1em; vertical-align: middle;">.
   * Enter a Regex pattern matching the URL structure (e.g., `example\.com/page/\d+`).
   * Save the pattern. The extension links it to your existing bookmark.

2. **Save Your Progress:**
   * As you continue reading or watching, simply click the icon <img src="icon-32.png" style="height: 1.1em; vertical-align: middle;"> again.
   * Your bookmark is automatically updated to the current URL!

---

## 🛠️ Installation (Local / Development)

1. Download or clone this repository:
```bash
git clone git@github.com:jamoellm/quickmark.git
```
2. Open Firefox and type `about:debugging#/runtime/this-firefox` in the address bar.
3. Click **"Load Temporary Add-on..."**.
4. Select any file from the project directory.

---

## 🔒 Permissions

This extension uses the following Firefox Manifest V2 permissions:

* `bookmarks`: To search and update your saved bookmarks.
* `activeTab`: To read the URL of your currently active tab.
* `storage`: To store your defined Regex patterns locally.

All data is stored locally.

---

Icons by [Icons8.com](https://icons8.com/icons/set/folder--style-dusk)

