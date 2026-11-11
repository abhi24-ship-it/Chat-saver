// Chat Saver - print.js
// Shows the clean chat page made by the popup, then opens the print dialog.
// Choose "Save as PDF" there. The page title becomes the PDF's file name.
chrome.storage.local.get('printJob').then(({ printJob }) => {
  if (!printJob) {
    document.getElementById('content').textContent = 'Nothing to print. Open a chat and use the Chat Saver button.';
    return;
  }
  document.title = printJob.fileName;
  // Safe: this HTML was rebuilt by content.js from plain tags, with all text escaped.
  document.getElementById('content').innerHTML = printJob.html;
  chrome.storage.local.remove('printJob');
  setTimeout(() => window.print(), 300);
});
