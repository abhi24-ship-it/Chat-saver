// Chat Saver - content.js
// The popup injects this file into the chat tab when you click the extension icon.
// It reads the chat that is already on the page and returns it to the popup as
// Markdown + clean HTML. It makes no network requests.
(async () => {
  // ---------- 1. Find the messages (one small set of rules per chat website) ----------
  // ChatGPT and Claude (2026 layouts) only keep a few messages on the page at a time and add the
  // rest as you scroll. So we scroll through the whole chat and convert every message while it is
  // on the page. Each site only says how to find a message ("row") and how to read it.
  // read() returns a message, null = "not filled in yet, try again", false = "not a message, skip it".

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const attached = files => files.length ? 'Attached: ' + files.join(', ') : '';

  const SITES = [
    {
      name: 'ChatGPT',
      rows: '[data-chatgpt-search-unit-key$=":user"], [data-chatgpt-search-unit-key$=":assistant"]',
      // ChatGPT also keeps a hidden copy of the chat; use the visible scroll box
      box: () => [...document.querySelectorAll('.thread-scroll-container')].find(e => e.clientHeight > 0),
      key: r => r.getAttribute('data-chatgpt-search-unit-key').split(':').pop() + '|' +
        (r.getAttribute('data-chatgpt-search-message-ids') || r.getAttribute('data-chatgpt-search-unit-key')),
      read(r) {
        if (r.getAttribute('data-chatgpt-search-unit-key').endsWith(':user')) {
          const files = [...r.querySelectorAll('[class*="resource-card"] .font-semibold')].map(f => f.textContent.trim());
          const textBox = r.querySelector('.whitespace-pre-wrap');
          const text = textBox ? textBox.textContent.trim() : '';
          return userMessage([attached(files), text].filter(Boolean).join('\n\n'));
        }
        const body = r.querySelector('[data-markdown-copy]');
        return body && body.textContent.trim() ? richMessage('assistant', [body]) : null;
      }
    },
    {
      name: 'Claude',
      rows: '[data-testid="transcript-row"]',
      key: r => r.getAttribute('data-index'),
      sortByKey: true, // rows are numbered 0, 1, 2 … in chat order
      // Claude labels each message "Message 7 of 10", so we know how many there should be
      total: () => Number((document.querySelector('[data-testid="transcript-row"] [aria-setsize]') || { getAttribute: () => 0 }).getAttribute('aria-setsize')),
      read(r) {
        const user = r.querySelector('[data-testid="user-message"]');
        if (user) { // Claude shows your message formatted (lists, code), so convert it like a reply
          const files = [...r.querySelectorAll('[data-testid="file-thumbnail"]')]
            .map(t => (t.querySelector('[title]') || t).getAttribute('title') || t.textContent.trim());
          return richMessage('user', [user], attached(files));
        }
        const reply = r.querySelector('[data-testid="assistant-message"]');
        if (!reply) return false;
        const parts = [...reply.querySelectorAll('[data-perf-reply-text]')]; // skips the "thinking" summary
        return parts.some(p => p.textContent.trim()) ? richMessage('assistant', parts) : null;
      }
    }
  ];

  // nearest parent that scrolls
  function scrollBoxOf(el) {
    for (let e = el && el.parentElement; e; e = e.parentElement) {
      if (e.scrollHeight > e.clientHeight + 10 && /(auto|scroll)/.test(getComputedStyle(e).overflowY)) return e;
    }
    return document.scrollingElement;
  }

  async function collectByScrolling(site) {
    const box = (site.box && site.box()) || scrollBoxOf(document.querySelector(site.rows));
    const rows = () => [...box.querySelectorAll(site.rows)];

    const saved = new Map(); // key -> { msg, size }
    const order = [];        // keys in chat order

    for (let round = 0; round < 2; round++) {
      // a) scroll to the top until no older messages are loading
      let firstKey = null, steady = 0;
      for (let i = 0; i < 150 && steady < 3; i++) {
        box.scrollTop = 0;
        await sleep(600);
        const first = rows()[0];
        const key = first && site.key(first);
        const loading = box.textContent.includes('Loading older messages');
        steady = key === firstKey && !loading ? steady + 1 : 0;
        firstKey = key;
      }

      // b) walk down one screen at a time, so every part of the chat passes the screen.
      //    Save each message (again if it has grown: a reply's text is filled in a moment after it appears).
      const atBottom = () => box.scrollTop + box.clientHeight >= box.scrollHeight - 5;
      let lastCount = -1, same = 0;
      for (let i = 0; i < 5000 && same < 3; i++) {
        await sleep(300);
        let at = -1; // position in `order` of the previous message on screen
        let next = box.scrollTop + box.clientHeight;
        const boxTop = box === document.scrollingElement ? 0 : box.getBoundingClientRect().top;
        for (const r of rows()) {
          const key = site.key(r);
          if (!order.includes(key)) order.splice(at + 1, 0, key);
          at = order.indexOf(key);
          const size = r.textContent.length;
          if (size > (saved.has(key) ? saved.get(key).size : -1)) {
            const msg = site.read(r);
            if (msg === false) saved.set(key, { msg: null, size: Infinity }); // not a message
            else if (msg) saved.set(key, { msg, size });
          }
          // a very long message we already saved: jump to near its end instead of crawling through it
          const rect = r.getBoundingClientRect();
          const top = rect.top - boxTop + box.scrollTop, bottom = top + rect.height;
          if (saved.has(key) && top <= next && bottom > next) next = Math.max(next, bottom - box.clientHeight / 2);
        }
        // finished only when we are at the very bottom and nothing new was saved 3 times in a row
        same = atBottom() && saved.size === lastCount ? same + 1 : 0;
        lastCount = saved.size;
        box.scrollTop = next;
      }
      const total = site.total ? site.total() : 0;
      if (order.every(key => saved.has(key)) && order.length >= total) break; // complete; otherwise go round once more
    }
    if (site.sortByKey) order.sort((a, b) => a - b);
    return order.map(key => saved.has(key) && saved.get(key).msg).filter(Boolean);
  }

  // ---- Older layouts (no scrolling needed): kept as a fallback ----

  // ChatGPT (older layout): every message has data-message-author-role="user" / "assistant".
  function findChatGPT() {
    const els = document.querySelectorAll('[data-message-author-role="user"], [data-message-author-role="assistant"]');
    return [...els].map(el => {
      const role = el.getAttribute('data-message-author-role');
      const body = role === 'user' ? el.querySelector('.whitespace-pre-wrap') : el.querySelector('.markdown');
      return { role, el: body || el };
    });
  }

  // Claude (older layout): your messages are data-testid="user-message", replies are .font-claude-response.
  function findClaude() {
    const els = [...document.querySelectorAll('[data-testid="user-message"], .font-claude-response, .font-claude-message')];
    return els
      .filter(el => !els.some(other => other !== el && other.contains(el))) // skip nested matches
      .map(el => ({ role: el.matches('[data-testid="user-message"]') ? 'user' : 'assistant', el }));
  }

  // ---------- 2. Code blocks ----------

  // Returns the <pre> if this element is a code block (or just a wrapper around one).
  // Both sites put a language label and a "Copy" button next to the code; we drop those.
  function codePre(n) {
    if (n.tagName === 'PRE') return n;
    if (n.tagName !== 'DIV') return null;
    const pres = n.querySelectorAll('pre');
    if (pres.length !== 1) return null;
    const pre = pres[0];
    let rest = n.textContent.replace(pre.textContent, '');
    n.querySelectorAll('button').forEach(b => { rest = rest.replace(b.textContent, ''); });
    rest = rest.toLowerCase().split(codeLang(pre)).join('').trim();
    return rest === '' ? pre : null; // nothing else in here -> it's just a code-block wrapper
  }

  function codeText(pre) {
    const lines = pre.querySelectorAll('.cm-line'); // some code viewers draw one div per line
    const text = lines.length
      ? [...lines].map(l => l.textContent).join('\n')
      : (pre.querySelector('code') || pre).textContent;
    return text.replace(/ /g, ' ').replace(/\n$/, ''); // non-breaking spaces -> normal spaces
  }

  function codeLang(pre) {
    const code = pre.querySelector('code[class*="language-"]');
    const m = code && code.className.match(/language-([\w+#.-]+)/);
    return m ? m[1].toLowerCase() : '';
  }

  // Math (KaTeX) keeps its original LaTeX in an <annotation> tag.
  function mathTex(n) {
    const a = n.querySelector('annotation[encoding="application/x-tex"]');
    return (a ? a.textContent : n.textContent).trim();
  }

  // things that are not chat content: buttons, icons, screen-reader labels, ChatGPT's source chips
  const SKIP = 'button, svg, style, script, noscript, img, textarea, input, .sr-only, [data-d-component="popover-trigger"]';
  const isMath = n => n.classList.contains('katex');
  const isBlockMath = n => !!n.closest('.katex-display, [data-d-block]');
  const isBold = n => n.hasAttribute('data-d-default-strong');           // ChatGPT's new bold text
  const isRadio = n => n.getAttribute('data-d-component') === 'radio';  // quiz options in ChatGPT lessons

  // ---------- 3. HTML -> Markdown ----------

  let codeStore = []; // code blocks are set aside so the newline clean-up can't touch them

  function mdChildren(el) {
    let s = '';
    for (const child of el.childNodes) s += mdNode(child);
    return s;
  }

  function mdNode(n) {
    if (n.nodeType === Node.TEXT_NODE) return n.textContent.replace(/\s+/g, ' ');
    if (n.nodeType !== Node.ELEMENT_NODE || n.matches(SKIP)) return '';
    if (isMath(n)) return isBlockMath(n) ? '\n\n$$' + mathTex(n) + '$$\n\n' : '$' + mathTex(n) + '$';
    const pre = codePre(n);
    if (pre) return mdCode(pre);

    const tag = n.tagName;
    const inner = () => mdChildren(n).trim();
    if (isBold(n)) return wrap('**', inner());
    if (isRadio(n)) return '\n- ( ) ' + n.textContent.trim() + '\n';
    if (/^H[1-6]$/.test(tag)) return '\n\n' + '#'.repeat(Number(tag[1])) + ' ' + inner() + '\n\n';
    switch (tag) {
      case 'P': case 'DIV': case 'SECTION': return '\n\n' + inner() + '\n\n';
      case 'BR': return '  \n';
      case 'HR': return '\n\n---\n\n';
      case 'STRONG': case 'B': return wrap('**', inner());
      case 'EM': case 'I': return wrap('*', inner());
      case 'DEL': case 'S': return wrap('~~', inner());
      case 'CODE': { // inline code (code blocks were handled above)
        const t = n.textContent;
        return t.includes('`') ? '`` ' + t + ' ``' : '`' + t + '`';
      }
      case 'A': {
        const href = n.getAttribute('href') || '';
        return /^https?:/i.test(href) ? '[' + inner() + '](' + href + ')' : inner();
      }
      case 'UL': case 'OL': return mdList(n);
      case 'TABLE': return mdTable(n);
      case 'BLOCKQUOTE': return '\n\n' + inner().split('\n').map(l => '> ' + l).join('\n') + '\n\n';
      default: return mdChildren(n);
    }
  }

  function wrap(mark, text) {
    return text ? mark + text + mark : '';
  }

  function mdCode(pre) {
    const code = codeText(pre);
    let fence = '```';
    while (code.includes(fence)) fence += '`';
    codeStore.push(fence + codeLang(pre) + '\n' + code + '\n' + fence);
    return '\n\n\u0000' + (codeStore.length - 1) + '\u0000\n\n';
  }

  function mdList(list) {
    let num = Number(list.getAttribute('start')) || 1;
    let out = '';
    for (const li of list.children) {
      if (li.tagName !== 'LI') continue;
      const marker = list.tagName === 'OL' ? num++ + '. ' : '- ';
      const body = mdChildren(li).trim().replace(/\n\s*\n/g, '\n');
      // indent the item's extra lines (e.g. a nested list) under its text
      out += marker + body.split('\n').join('\n' + ' '.repeat(marker.length)) + '\n';
    }
    return '\n\n' + out + '\n\n';
  }

  function mdTable(table) {
    const rows = [...table.querySelectorAll('tr')].map(tr =>
      [...tr.children].map(cell => mdChildren(cell).replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|'))
    );
    if (!rows.length) return '';
    const cols = Math.max(...rows.map(r => r.length));
    rows.forEach(r => { while (r.length < cols) r.push(''); });
    const line = r => '| ' + r.join(' | ') + ' |';
    const lines = [line(rows[0]), line(rows[0].map(() => '---')), ...rows.slice(1).map(line)];
    return '\n\n' + lines.join('\n') + '\n\n';
  }

  function toMarkdown(el) {
    codeStore = [];
    const md = mdChildren(el)
      .replace(/^[ \t]+$/gm, '')   // lines with only spaces -> empty
      .replace(/\n{3,}/g, '\n\n')  // at most one blank line in a row
      .trim();
    // put the code blocks back, always starting at the left edge so the code copies cleanly
    return md
      .replace(/^[ \t]*\u0000(\d+)\u0000[ \t]*$/gm, (_, i) => codeStore[i])
      .replace(/\u0000(\d+)\u0000/g, (_, i) => codeStore[i]);
  }

  // ---------- 4. HTML -> clean HTML (for the PDF) ----------
  // Rebuilds the message using only safe, simple tags with no classes or styles.

  const KEEP = ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'TABLE', 'THEAD', 'TBODY',
    'TR', 'TH', 'TD', 'STRONG', 'B', 'EM', 'I', 'DEL', 'S', 'BLOCKQUOTE', 'CODE', 'SUP', 'SUB'];

  function esc(s) {
    return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function htmlChildren(el) {
    let s = '';
    for (const child of el.childNodes) s += htmlNode(child);
    return s;
  }

  function htmlNode(n) {
    if (n.nodeType === Node.TEXT_NODE) return esc(n.textContent);
    if (n.nodeType !== Node.ELEMENT_NODE || n.matches(SKIP)) return '';
    if (isMath(n)) return isBlockMath(n) ? '<p><code>' + esc(mathTex(n)) + '</code></p>' : '<code>' + esc(mathTex(n)) + '</code>';
    const pre = codePre(n);
    if (pre) return '<pre><code>' + esc(codeText(pre)) + '</code></pre>';

    const tag = n.tagName;
    const t = tag.toLowerCase();
    if (isBold(n)) return '<strong>' + htmlChildren(n) + '</strong>';
    if (isRadio(n)) return '<p>○ ' + esc(n.textContent.trim()) + '</p>';
    if (tag === 'BR' || tag === 'HR') return '<' + t + '>';
    if (tag === 'A') {
      const href = n.getAttribute('href') || '';
      return /^https?:/i.test(href) ? '<a href="' + esc(href) + '">' + htmlChildren(n) + '</a>' : htmlChildren(n);
    }
    if (tag === 'OL') return '<ol start="' + (Number(n.getAttribute('start')) || 1) + '">' + htmlChildren(n) + '</ol>';
    if (KEEP.includes(tag)) return '<' + t + '>' + htmlChildren(n) + '</' + t + '>';
    return htmlChildren(n);
  }

  // ---------- 5. Put it together ----------

  // your own messages are plain text
  function userMessage(text) {
    return { role: 'user', markdown: text, html: '<p class="user-text">' + esc(text) + '</p>', text, codeBlocks: 0, tables: 0 };
  }

  // formatted message (headings, lists, tables, code); `note` is an optional first line, e.g. attached files
  function richMessage(role, els, note = '') {
    const count = sel => els.reduce((n, el) => n + el.querySelectorAll(sel).length, 0);
    return {
      role,
      markdown: [note, ...els.map(toMarkdown)].filter(Boolean).join('\n\n'),
      html: (note ? '<p>' + esc(note) + '</p>' : '') + els.map(htmlChildren).join(''),
      text: [note, ...els.map(el => el.innerText.trim())].filter(Boolean).join('\n'),
      codeBlocks: count('pre'),
      tables: count('table')
    };
  }

  let site = null;
  let messages = [];
  let expected = 0; // how many messages the site says the chat has (Claude only), to warn if some were missed
  for (const s of SITES) {
    if (document.querySelector(s.rows)) {
      site = s.name;
      messages = await collectByScrolling(s);
      expected = s.total ? s.total() : 0;
      break;
    }
  }
  if (!site) { // older layouts
    site = 'ChatGPT';
    let found = findChatGPT();
    if (!found.length) { site = 'Claude'; found = findClaude(); }
    messages = found.map(({ role, el }) => role === 'user'
      // ChatGPT keeps your text as-is in a "whitespace-pre-wrap" box; Claude uses one <p> per paragraph.
      ? userMessage((el.matches('.whitespace-pre-wrap') ? el.textContent : el.innerText).trim())
      : richMessage('assistant', [el]));
  }
  messages = messages.filter(m => m.markdown);

  // Title: from the browser tab title, e.g. "Explain RAG simply - Claude" -> "Explain RAG simply"
  let title = document.title
    .replace(/\s*[-|–—]\s*(Claude|ChatGPT)\s*$/i, '')
    .replace(/^(ChatGPT|Claude)\s*[-|–—]\s*/i, '')
    .trim();
  if (!title || /^(ChatGPT|Claude)$/i.test(title)) {
    const firstUser = messages.find(m => m.role === 'user');
    title = firstUser ? firstUser.text.split('\n')[0].slice(0, 60) : 'chat';
  }

  return { site, title, messages, expected };
})();
