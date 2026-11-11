# Prompts used (in order)

Agent: Claude Code (desktop app)

## Prompt 1: Plan and first working version

```
WHO: You are an experienced software developer helping me complete a GenAI internship project.
WHAT: I am building Project 12— Chat Saver from the attached Week 2 Projects PDF.
GOAL: Meet every mandatory "What to build" feature and every "Done when" condition. Do not add optional extras or overengineer the project.
DO:

1. Read the relevant PDF page thoroughly.
2. Identify all mandatory requirements.
3. List external software, dependencies, permissions and test files required.
4. Recommend the simplest practical implementation.
5. Build the working project incrementally.
6. Give me exact installation and execution commands.
7. Help me test every mandatory requirement.
8. Create a README with installation, execution and test instructions.
9. Help maintain a prompts.md file documenting the prompts used.

RULES:

* Prefer free, offline functionality without paid APIs.
* Use sample data wherever possible.
* Keep the code simple and understandable for a beginner.
* Avoid unnecessary frameworks, files and dependencies.
* Do not claim a feature works without testing it.
* Do not replace mandatory working features with mockups.
* Ask me to perform real-device or browser tests when necessary.
* Explain what each major component does so I can present it.

First, produce a short implementation plan and the exact external requirements. Then begin with the simplest working version.
```

**Result:** A Manifest V3 extension with no libraries (`manifest.json`, `popup.html/js`, `content.js`, `print.html/js`) and two offline 60-message test chats (`test-chats/`, ChatGPT-style and Claude-style).
- Supports ChatGPT and Claude. You can save all messages or only the ones you tick.
- Markdown is downloaded directly. PDF uses the browser's "Save as PDF". Both are named from the chat title.
- **Tested automatically:** on both samples, all 60 messages were saved, 15 code blocks matched the originals exactly, and 8 tables came out as tables. Code from the `.md` and from a Chrome-printed PDF ran with Python and Node. The popup's selection was tested. No network code was found.
- **Bug found and fixed:** ChatGPT user messages could lose their line breaks, so their raw text is now read directly.
- **Still to test in Brave:** real ChatGPT and Claude chats, copying code from the PDF viewer, and the Network tab.

## Prompt 2: First real ChatGPT test failed

(Screenshot only: Chat Saver opened on a real ChatGPT project chat, "Mathematics Roadmap and Lesson 1", in Brave and said "No chat messages found here.")

**Cause (so far):** the extension did run on the page. That error only appears when neither finder in `content.js` matched anything, so ChatGPT's current page must mark messages differently from what the code looks for (`data-message-author-role`).
**Next:** a DevTools console snippet that reports only the page's structure (attribute names and counts, plus the tag path around one answer and one code block) so the finder can be fixed against the real page.

## Prompt 3: Structure report and "any chat" idea

```
I want to make sure it doesnt only consider the llms chat
It should be able to convert any chat to a pdf (example whatsapp,discord, etc)
I will give you the page requirement for the chatgpt page here
Just keep the other things in mind
If the other things feel to complex then dont focus on that
Get the chatgpt and claude one right and perfectly working first
```

(Pasted with it: the structure report from the console snippet.)

**Result:** The report showed ChatGPT had moved to a new layout, with none of the old markers left. I asked to sign in to ChatGPT in Claude's built-in browser so I could study the real page directly.

## Prompt 4: Signed in

```
Signed in
```

**Result:**
- **What changed on ChatGPT:** messages are now "units" (`data-chatgpt-search-unit-key` ending in `:user` / `:assistant`). Answers are built from `data-d-component` parts that still use real `h1`/`p`/`ul`/`table`/`blockquote` tags. Bold is a `data-d-default-strong` span, and math is KaTeX.
- **The big change:** ChatGPT keeps only about 5 turns on the page at a time, fills an answer's text in a moment after it appears, and loads older messages on scroll-up. So `content.js` now scrolls to the top, walks down turn by turn and saves each message while it's on the page.
- **Bugs found and fixed while testing:**
  - Answers were saved while still empty. Now an answer is saved only once it has text, and saved again if it grows.
  - The walk stopped early when the page was slow to add the next turns. Now it stops only at the real bottom.
- **New:** quiz options become `- ( ) option`, ChatGPT's source chips are skipped, and an attachment-only message becomes "Attached: file names". The popup tells you to keep it open while it scrolls.
- **Tested:** the real chat "Mathematics Roadmap and Lesson 1" (12 messages, 50 tables, math, quizzes) was saved completely in about 10 s. A new offline test page, `test-chats/chatgpt-sample.html`, copies the 2026 layout and its scrolling behaviour; all 60 messages were saved in order with code identical to the originals. The old-layout ChatGPT and Claude test pages still pass.
- **Not done yet:** how code blocks look in the new ChatGPT layout (this chat has none), a real 50+ message chat, and claude.ai (not signed in to it in the pane). WhatsApp, Discord and other chat apps are planned as a "save what I've highlighted" option once ChatGPT and Claude are finished.

## Prompt 5: Works in Brave

```
its working now
```

**Result:** I signed in to claude.ai in the browser pane and checked Claude's 2026 layout.
- **What changed on Claude:** each message is a `transcript-row` with a `data-index` number. Replies are `assistant-message`, with the text in `[data-perf-reply-text]` blocks; the "thinking" summary sits outside those blocks and is skipped. Your messages are shown formatted (lists, inline code), so they're converted like replies, and attached files are listed. Code blocks are still `pre > code.language-…`.
- **Claude only builds rows near the screen, and leaves gaps** (rows 0–3 and 7–9 present, 4–6 missing). The first run skipped rows 4–5 and put row 6 first.
- **Fixes:**
  - Both sites now share one scroll-and-collect function. It walks down one screen at a time and jumps quickly past long messages already saved.
  - Claude rows are sorted by their number, and Claude's "Message N of M" label is used to check that nothing is missing. The popup warns if any message couldn't be read.
- **Tested:**
  - Real Claude chat: 10 of 10 messages in order in 5.6 s, and both code blocks are identical to the page.
  - Real ChatGPT chat: still all 12 messages, unchanged, in 11 s.
  - All three offline 60-message test pages pass (the scrolling ChatGPT one takes 22 s).
- **Also:** I couldn't find the saved `.md` / `.pdf` files in Downloads, Documents or Desktop.

## Prompt 6: Make the sample PDF instead of a new chat

```
i mean since it works now there is no need of creating another sample text chat
You can create it and create a pdf on that just for convenience of the completion of the project
```

**Result:** No new chat was created on the ChatGPT account. Instead, the two 60-message test chats were exported with the extension's own code (`content.js` + the popup's Markdown/PDF builders + `print.html`). Chrome's "Save as PDF" engine made the PDFs. They're saved in `sample-output/`: `Explain RAG simply.md/.pdf` (ChatGPT 2026 layout, 17 pages) and `RAG study notes.md/.pdf` (Claude style, 16 pages).
**Checked:**
- All 60 messages are in every file, with 8 real tables each.
- Python and JavaScript code copied from the `.md` runs, and Python copied out of the `.pdf` runs.
- Each PDF's title is the chat title.

## Prompt 7: Network check done

```
Done, no requests
```

**Result:** The "sends nothing to any server" check passed in Brave's DevTools Network tab. Every mandatory feature and "Done when" condition now has a passing test, recorded in the README. One known gap is written down there: no real ChatGPT chat containing code has been seen in the 2026 layout.

## Prompt 8: What to put on GitHub

```
tell me all the things to add in github for this
```

**Result:** A list of the files to upload: the whole `chat-saver` folder (16 files), which has no secrets, build output or other generated files, so no `.gitignore` is needed. Two README fixes for people who clone it: the install step no longer shows a personal `C:\Users\…` path, and the test-server command now runs from inside the `chat-saver` folder.
