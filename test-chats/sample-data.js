// Sample data for the offline test pages: a 60-message chat (30 questions + 30 answers)
// with headings, lists, nested lists, tables, code blocks, quotes, links and math.
// Each test page supplies its own codeBlock() because ChatGPT and Claude mark up code differently.

const PY_CODE = `def retrieve(query, docs):
    """Return the docs that share a word with the query."""
    words = set(query.lower().split())
    results = []
    for doc in docs:
        if words & set(doc.lower().split()):
            results.append(doc)


    return results


docs = ["RAG uses retrieval", "Pizza is tasty", "retrieval helps <LLMs> & search"]
found = retrieve("Retrieval", docs)
assert len(found) == 2, found
print("OK, found:", found)`;

const JS_CODE = `const scores = [42, 7, 19];
const sorted = [...scores].sort((a, b) => a - b);
if (sorted.join(",") !== "7,19,42") throw new Error("bad sort");
console.log("OK, sorted:", sorted.join(" < "));`;

const MATH = '<span class="katex"><span class="katex-mathml"><math><semantics><mrow><mi>cos</mi></mrow>' +
  '<annotation encoding="application/x-tex">\\cos(\\theta) = \\frac{a \\cdot b}{|a||b|}</annotation></semantics></math></span>' +
  '<span class="katex-html" aria-hidden="true">cos(θ)=a·b/|a||b|</span></span>';

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Syntax highlighting splits code into many <span>s, like the real sites do.
function highlight(code) {
  return esc(code).replace(/\b(def|return|for|in|if|const|throw|new)\b/g, '<span class="hljs-keyword">$1</span>');
}

function question(n) {
  const topics = ['Explain RAG simply.', 'Compare search methods in a table.', 'Give me a study plan.', 'What are the key ideas?'];
  return `Question ${n}: ${topics[(n - 1) % 4]}` + (n % 2 ? '\nPlease keep it short.' : '');
}

function answer(n, codeBlock) {
  switch ((n - 1) % 4) {
    case 0: return `<h3>Answer ${n}: RAG in one minute</h3>
      <p><strong>RAG</strong> = <em>retrieval</em> + generation. Steps:</p>
      <ol><li><p>Split documents into chunks.</p></li><li><p>Find chunks that match the question.</p></li><li><p>Give them to the model with the question.</p></li></ol>
      <p>Tiny Python version:</p>
      ${codeBlock('python', PY_CODE)}
      <p>Run it with <code>python rag.py</code>.</p>`;
    case 1: return `<h3>Answer ${n}: Comparison table</h3>
      <p>Here is how the options compare:</p>
      <table><thead><tr><th>Method</th><th>Speed</th><th>Needs GPU?</th><th>Example</th></tr></thead>
      <tbody><tr><td>Keyword search</td><td>Fast</td><td>No</td><td><code>grep "rag"</code></td></tr>
      <tr><td>Vector search</td><td>Medium</td><td>Sometimes</td><td>a | b pipes</td></tr>
      <tr><td><strong>Re-ranking</strong></td><td>Slow</td><td>Yes</td><td>cross-encoder</td></tr></tbody></table>
      <p>Pick keyword search for small projects.</p>`;
    case 2: return `<h3>Answer ${n}: Study plan</h3>
      <ul><li>Week 1<ul><li>Python basics</li><li>Lists &amp; dictionaries</li></ul></li>
      <li>Week 2<ul><li>APIs</li><li>Embeddings</li></ul></li></ul>
      <ol start="3"><li>Sort some scores in JavaScript:${codeBlock('javascript', JS_CODE)}</li>
      <li>Check the output says <code>OK</code>.</li></ol>`;
    default: return `<h2>Answer ${n}: Key ideas</h2>
      <blockquote><p>Good retrieval matters more than a bigger model.</p></blockquote>
      <p>Cosine similarity is ${MATH}. Read <a href="https://en.wikipedia.org/wiki/Retrieval-augmented_generation">the Wikipedia page</a>.</p>
      <hr><p>Use <code>top_k = 3</code> to start.</p>`;
  }
}
