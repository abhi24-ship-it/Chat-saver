// Chat Saver - popup.js
// Runs the small window that opens when you click the extension icon.
// 1. Injects content.js into the current tab to read the chat.
// 2. Shows the messages with checkboxes so you can pick which to save.
// 3. Builds the Markdown file or the PDF page from the picked messages.

let chat = null;   // { site, title, messages: [{ role, markdown, html, text, codeBlocks, tables }] }
let boxes = [];    // one checkbox per message

const $ = id => document.getElementById(id);

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    chat = res.result;
  } catch (e) {
    $('status').textContent = 'Cannot read this page. Open a ChatGPT or Claude chat and try again.';
    return;
  }
  if (!chat || !chat.messages.length) {
    $('status').textContent = 'No chat messages found here. Open a chat on chatgpt.com or claude.ai.';
    return;
  }

  $('title').textContent = chat.title + ' (' + chat.site + ')';
  chat.messages.forEach((m, i) => {
    const li = document.createElement('li');
    li.innerHTML = '<label><input type="checkbox" checked><span class="who"></span><span class="preview"></span></label>';
    li.querySelector('.who').textContent = m.role === 'user' ? 'You' : chat.site;
    li.querySelector('.who').classList.add(m.role);
    li.querySelector('.preview').textContent = (i + 1) + '. ' + m.text.replace(/\s+/g, ' ').slice(0, 80);
    $('list').appendChild(li);
  });
  boxes = [...document.querySelectorAll('#list input')];
  boxes.forEach(b => b.addEventListener('change', updateStats));
  $('all').addEventListener('change', () => { boxes.forEach(b => { b.checked = $('all').checked; }); updateStats(); });
  $('md').addEventListener('click', saveMarkdown);
  $('pdf').addEventListener('click', savePdf);

  if (chat.expected > chat.messages.length) { // the site says there are more messages than we could read
    $('status').textContent = 'Warning: read ' + chat.messages.length + ' of ' + chat.expected +
      ' messages. Close this window and try again.';
  } else {
    $('status').hidden = true;
  }
  $('main').hidden = false;
  updateStats();
}

function selected() {
  return chat.messages.filter((m, i) => boxes[i].checked);
}

function updateStats() {
  const picked = selected();
  $('nMsgs').textContent = picked.length;
  $('nCode').textContent = picked.reduce((sum, m) => sum + m.codeBlocks, 0);
  $('nTables').textContent = picked.reduce((sum, m) => sum + m.tables, 0);
  $('all').checked = picked.length === boxes.length;
  $('md').disabled = $('pdf').disabled = picked.length === 0;
}

// Chat title -> safe file name (Windows does not allow \ / : * ? " < > |)
function fileName(title) {
  return title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/\s+/g, ' ').replace(/[. ]+$/, '').trim().slice(0, 80) || 'chat';
}

function header(msgs) {
  return 'Saved from ' + chat.site + ' on ' + new Date().toLocaleDateString() + ' - ' + msgs.length + ' messages';
}

function buildMarkdown(msgs) {
  const parts = ['# ' + chat.title, '*' + header(msgs) + '*'];
  for (const m of msgs) parts.push('---', '## ' + (m.role === 'user' ? 'You' : chat.site), m.markdown);
  return parts.join('\n\n') + '\n';
}

function esc(s) {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function buildHtml(msgs) {
  let html = '<h1>' + esc(chat.title) + '</h1><p class="meta">' + esc(header(msgs)) + '</p>';
  for (const m of msgs) {
    html += '<section class="msg ' + m.role + '"><h2 class="who">' + (m.role === 'user' ? 'You' : esc(chat.site)) + '</h2>' + m.html + '</section>';
  }
  return html;
}

// Markdown: make a file in memory and download it. Nothing is uploaded.
function saveMarkdown() {
  const blob = new Blob([buildMarkdown(selected())], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName(chat.title) + '.md';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// PDF: hand the clean page to print.html, which opens the browser's "Save as PDF" dialog.
async function savePdf() {
  await chrome.storage.local.set({ printJob: { fileName: fileName(chat.title), html: buildHtml(selected()) } });
  chrome.tabs.create({ url: 'print.html' });
}

init();
