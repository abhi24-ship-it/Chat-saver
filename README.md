# Chat Saver 

A Chrome/Brave extension that saves an AI chat from **ChatGPT** or **Claude** as a clean **Markdown** or **PDF** file in one click.
It keeps headings, lists, tables and code blocks, names the file from the chat's title, and **sends nothing to any server**.

## Requirements

| Needed | Why |
|---|---|
| Brave or Google Chrome (any recent version) | Runs the extension and makes the PDF ("Save as PDF" in the print dialog) |
| Python 3 (already installed) | Only for testing: serves the sample chat pages and runs saved code |
| A ChatGPT and a Claude account (free plans are fine) | Real-site test with a long chat |

No npm, no libraries, no API keys, no internet needed by the extension.

**Permissions** (in `manifest.json`):
- `activeTab`: read the tab you're on, only when you click the Chat Saver icon
- `scripting`: put `content.js` into that tab to read the chat
- `storage`: hand the chat from the popup to the PDF page (stays on your computer)

There are no host permissions, so the extension can't touch any site by itself.

## Files

| File | What it does |
|---|---|
| `manifest.json` | Tells the browser the extension's name, permissions and popup |
| `popup.html` / `popup.js` | The small window: message list with checkboxes, counts, the two Save buttons. Builds the Markdown file and the PDF page |
| `content.js` | Runs inside the chat page. Finds the messages, then converts each one to Markdown and to clean HTML. ChatGPT 2026: `data-chatgpt-search-unit-key` ending in `:user` / `:assistant`. Claude 2026: `data-testid="transcript-row"` numbered by `data-index`, holding `user-message` or `assistant-message`. Older layouts of both sites still work as a fallback |
| `print.html` / `print.js` | The clean page used for the PDF. Opens the print dialog; its title becomes the PDF file name |
| `sample-output/` | Example `.md` and `.pdf` files made by Chat Saver from the 60-message test chats (see "Sample output") |
| `test-chats/` | Offline test pages, each a 60-message chat with code, tables, lists, a quote and math: `chatgpt-sample.html` (2026 layout, which also copies ChatGPT's scrolling behaviour), `chatgpt-old-sample.html` (older layout) and `claude-sample.html` |

### How the conversion works (for your presentation)
1. **Find messages**: each chat site marks "your message" and "AI message" differently, so there is one small finder per site.
   - **ChatGPT and Claude only keep a few messages on the page at a time.** Claude even leaves gaps, for example rows 0–3 and 7–9 present with 4–6 not built yet. Older messages load when you scroll up, and a reply's text is filled in a moment after it appears. So Chat Saver first scrolls to the top until nothing older is loading. Then it walks down **one screen at a time**, so every part of the chat passes the screen, and saves each message while it's on the page, keeping the longest version it saw. It jumps quickly past long messages it has already saved and stops only at the real bottom. Claude labels messages "Message 7 of 10", so if any are missing it goes round again, and the popup warns you if it still couldn't read them all.
2. **Walk the HTML**: `content.js` goes through every element of a message. `<h2>` becomes `##`, `<li>` becomes `- `, `<table>` becomes a `| a | b |` table, and `<strong>` (or ChatGPT's new `data-d-default-strong` span) becomes `**bold**`. Math becomes `$…$`, using the LaTeX the page keeps. Quiz options become `- ( ) option`. Buttons, icons and source chips are skipped.
3. **Code blocks**: the text is taken from the `<code>` tag only. The "Copy" button and language label are dropped, and the code is put aside so no clean-up step can change its spaces or blank lines. That's why the saved code still runs.
4. **PDF**: the same messages are rebuilt as plain, safe HTML (no site styles) and printed with the browser's own "Save as PDF". The PDF has real text, so code and tables can be selected and copied.

## Install (Brave)

1. Open `brave://extensions` (in Chrome: `chrome://extensions`).
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked**. Choose the `chat-saver` folder (the one with `manifest.json` in it).
4. Pin it: click the puzzle icon in the toolbar, then the pin next to **Chat Saver**.

After you change any file, click the reload ↻ icon on the extension card.

## Use

1. Open a chat on chatgpt.com or claude.ai.
2. Click the **Chat Saver** icon. You'll see the title, counts (messages, code blocks, tables) and the list of messages.
3. Keep **Select all** ticked to save everything, or untick it and tick only the messages you want.
4. Click **Save as Markdown**: `<chat title>.md` goes to your Downloads folder.
5. Click **Save as PDF**: a clean page opens with the print dialog. Set **Destination: Save as PDF**, then **Save**. The file name is the chat title.

## Test it

### A. Offline sample chats (no internet)
From inside the `chat-saver` folder:

```bash
python -m http.server 8012
```

Open http://localhost:8012/test-chats/chatgpt-sample.html, then http://localhost:8012/test-chats/claude-sample.html. Click Chat Saver on each one. It should show **60 messages, 15 code blocks, 8 tables**.

### B. Check each "Done when" condition

| Condition | How to check |
|---|---|
| A long chat of 50+ messages saves completely | Save a 60-message sample chat (or a real chat with 50+ messages). The `.md` should end with the last message, and the message count in the file's second line should match |
| Code from the saved file can be copied and still runs | Open the `.md` in Notepad and copy the Python block (between the ```` ``` ```` lines) into `test.py`. Then run `python test.py`. Do the same from the PDF |
| Tables stay as tables | `.md`: open it in VS Code with Ctrl+Shift+V (preview) and you should see a real table. PDF: you should see a table with borders |
| It sends nothing to any server | Right-click the Chat Saver icon, then **Inspect popup**, then open the **Network** tab. Click both Save buttons. Only `chrome-extension://` / `blob:` entries should appear, with no `http(s)` requests. Also run the code search below |

Code search for network calls (should print nothing):

```bash
Select-String -Path chat-saver\*.js,chat-saver\*.html -Pattern "fetch|XMLHttpRequest|sendBeacon|WebSocket"
```

To run the Python example from a saved file (after pasting it into `test.py`):

```bash
python test.py
```

Expected output: `OK, found: ['RAG uses retrieval', 'retrieval helps <LLMs> & search']`

### Test results

| Test | Result |
|---|---|
| ChatGPT 2026-layout sample (60 msgs, only nearby turns on the page, late-filled answers, older messages loading): all 60 saved in order, 15 code blocks identical to the originals, 8 tables, bold, math, quiz options, no button text (22 s) | ✅ passed (automated) |
| Older-ChatGPT and Claude-style samples (60 msgs each): same checks, no stray "python" / "Copy" labels | ✅ passed (automated) |
| Python and JavaScript code taken from the saved `.md` runs (`python`, `node`) | ✅ passed (automated) |
| PDF (printed by headless Chrome): 16 pages, all 60 messages, 8 tables detected, Python code taken from the PDF runs | ✅ passed (automated, before the ChatGPT 2026 changes) |
| Popup: select only 2 messages, then only those 2 are saved; file name = chat title | ✅ passed (popup tested with a stand-in for the browser API) |
| Real ChatGPT chat "Mathematics Roadmap and Lesson 1" (12 messages, attachment-only first message, 50 tables, math, quizzes), converter run in the browser pane | ✅ all 12 saved; last answer matches the screen (11 s) |
| Real Claude chat "Cybersecurity CTF challenge solving" (10 messages, only some on the page at a time, file attachments, 2 code blocks), converter run in the browser pane | ✅ 10 of 10 saved in order (5.6 s); both code blocks identical to the page |
| Chat Saver popup on a real ChatGPT chat in Brave | ✅ you reported "it's working now" |
| **50+ messages, MD + PDF** (`sample-output/`, see below): both 60-message test chats exported with the extension's own code. All 60 messages are in each `.md` and `.pdf`, 8 tables each, and Python/JavaScript code copied out of the `.md` and the `.pdf` runs | ✅ passed |
| Real ChatGPT chat with a code block | ⬜ not checked: no real ChatGPT chat with code has been seen in the 2026 layout (you chose not to create a test chat) |
| Code copied out of the PDF runs | ✅ passed (Python taken from both sample PDFs runs) |
| **Sends nothing to any server**: Brave DevTools → Inspect popup → Network tab while clicking both Save buttons | ✅ you confirmed: no requests |

### Sample output (for submission)

`sample-output/` holds files made by Chat Saver from the two 60-message test chats. The extension's own code was used: `content.js` read the chat, `popup.js` built the Markdown and PDF page, and `print.html` styled it. Chrome's "Save as PDF" engine, the same one Brave uses, made the PDFs.

| File | From | What's inside |
|---|---|---|
| `Explain RAG simply.md` / `.pdf` | `test-chats/chatgpt-sample.html` (ChatGPT 2026 layout, scrolling) | 60 messages, 15 code blocks, 8 tables, math, quotes, quiz options; PDF is 17 pages |
| `RAG study notes.md` / `.pdf` | `test-chats/claude-sample.html` (Claude style) | 60 messages, 15 code blocks, 8 tables; PDF is 16 pages |

The file names come from each chat's title ("Explain RAG simply", "RAG study notes - Claude" → "RAG study notes").

## Limits
- ChatGPT and Claude change their page structure now and then. If Chat Saver says "No chat messages found", the selectors at the top of `content.js` need updating.
- Pictures and file uploads in a chat are not saved (text only). Claude "artifacts" (side panels) are not included.
- PDF needs one extra click on **Save** in the print dialog. That's the browser's own offline PDF maker.
