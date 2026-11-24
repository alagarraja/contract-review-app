// ---------- Contract upload & preview ----------
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const viewerWrap = document.getElementById('viewer-wrap');
const pdfViewer = document.getElementById('pdf-viewer');
const uploadError = document.getElementById('upload-error');
const fileInfo = document.getElementById('file-info');
const fileNameEl = document.getElementById('file-name');
const fileSizeEl = document.getElementById('file-size');
const openLink = document.getElementById('open-link');
const replaceBtn = document.getElementById('replace-btn');
const statusEl = document.getElementById('status');
const statusText = document.getElementById('status-text');

let currentPdfUrl = null;
let currentFile = null; // the uploaded contract, sent to the webhook with each question

function isPdf(file) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function showPdf(file) {
  if (!file) return;

  if (!isPdf(file)) {
    uploadError.textContent = 'That doesn’t look like a PDF. Please choose a .pdf file.';
    return;
  }
  uploadError.textContent = '';
  currentFile = file;

  // Free the previous file's memory before showing a new one.
  if (currentPdfUrl) URL.revokeObjectURL(currentPdfUrl);
  currentPdfUrl = URL.createObjectURL(file);

  pdfViewer.src = currentPdfUrl;
  openLink.href = currentPdfUrl;
  viewerWrap.hidden = false;
  dropZone.hidden = true;
  replaceBtn.hidden = false;

  fileNameEl.textContent = file.name;
  fileNameEl.title = file.name;
  fileSizeEl.textContent = formatSize(file.size);
  fileInfo.hidden = false;

  statusEl.classList.add('ready');
  statusText.textContent = 'Contract loaded';

  addMessage(`I’ve loaded “${file.name}”. What would you like to know?`, 'assistant');
}

fileInput.addEventListener('change', () => {
  showPdf(fileInput.files[0]);
  fileInput.value = ''; // allow re-selecting the same file
});

replaceBtn.addEventListener('click', () => fileInput.click());

['dragenter', 'dragover'].forEach((evt) =>
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  })
);

['dragleave', 'drop'].forEach((evt) =>
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
  })
);

dropZone.addEventListener('drop', (e) => showPdf(e.dataTransfer.files[0]));

// Allow dropping a replacement PDF onto the preview too.
viewerWrap.addEventListener('dragover', (e) => e.preventDefault());
viewerWrap.addEventListener('drop', (e) => {
  e.preventDefault();
  showPdf(e.dataTransfer.files[0]);
});

// Stop the browser from navigating to a PDF dropped outside a drop target.
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

// ---------- Chat ----------
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const messages = document.getElementById('messages');
const chips = document.getElementById('chips');

const WEBHOOK_URL = 'https://alagarrajam.app.n8n.cloud/webhook/ba46dfcb-1271-4642-81aa-160df2a7b639';
let isSending = false;

// Sends the contract file and the question to the webhook and returns
// { response, citation[], reasoning }.
async function askWebhook(file, question) {
  const body = new FormData();
  body.append('file', file, file.name);
  body.append('message', question);

  const res = await fetch(WEBHOOK_URL, { method: 'POST', body });
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`The server returned ${res.status}. ${raw.slice(0, 200)}`.trim());
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('The server did not return valid JSON.');
  }
  if (Array.isArray(data)) data = data[0]; // n8n sometimes wraps the object in an array
  if (!data || typeof data.response !== 'string') {
    throw new Error('The server response was missing the "response" field.');
  }

  return {
    response: data.response,
    citation: Array.isArray(data.citation) ? data.citation.map(String) : [],
    reasoning: typeof data.reasoning === 'string' ? data.reasoning : '',
  };
}

function addAnswer({ response, citation, reasoning }) {
  const el = document.createElement('div');
  el.className = 'message assistant answer';

  const text = document.createElement('p');
  text.className = 'answer-text';
  text.textContent = response;
  el.appendChild(text);

  // Nothing to show beneath the "not mentioned" answer.
  if (citation.length) {
    const sec = document.createElement('div');
    sec.className = 'answer-section';
    sec.innerHTML = '<h3>Citations</h3>';
    const list = document.createElement('ul');
    list.className = 'citations';
    citation.forEach((c) => {
      const li = document.createElement('li');
      li.textContent = c;
      list.appendChild(li);
    });
    sec.appendChild(list);
    el.appendChild(sec);
  }

  if (reasoning) {
    const sec = document.createElement('div');
    sec.className = 'answer-section';
    sec.innerHTML = '<h3>Reasoning</h3>';
    const p = document.createElement('p');
    p.className = 'reasoning';
    p.textContent = reasoning;
    sec.appendChild(p);
    el.appendChild(sec);
  }

  messages.appendChild(el);
  scrollToBottom();
}

function scrollToBottom() {
  messages.scrollTop = messages.scrollHeight;
}

function addMessage(text, role) {
  const el = document.createElement('div');
  el.className = `message ${role}`;
  el.textContent = text; // textContent avoids injecting HTML
  messages.appendChild(el);
  scrollToBottom();
  return el;
}

function showTyping() {
  const el = document.createElement('div');
  el.className = 'message assistant typing';
  el.setAttribute('aria-label', 'Assistant is typing');
  el.innerHTML = '<span></span><span></span><span></span>';
  messages.appendChild(el);
  scrollToBottom();
  return el;
}

function autoResize() {
  chatInput.style.height = 'auto';
  chatInput.style.height = chatInput.scrollHeight + 'px';
  chatInput.style.overflowY = chatInput.scrollHeight > 140 ? 'auto' : 'hidden';
}

function updateSendState() {
  sendBtn.disabled = isSending || chatInput.value.trim() === '';
}

async function sendMessage(text) {
  text = text.trim();
  if (!text || isSending) return;

  addMessage(text, 'user');
  chatInput.value = '';
  autoResize();

  if (!currentFile) {
    addMessage('Please upload a contract PDF on the left first, then ask your question.', 'assistant');
    updateSendState();
    return;
  }

  isSending = true;
  updateSendState();
  const typing = showTyping();

  try {
    addAnswer(await askWebhook(currentFile, text));
  } catch (err) {
    const offline = err instanceof TypeError; // fetch network/CORS failure
    addMessage(
      offline
        ? 'I couldn’t reach the review service. Check your connection and that the workflow is listening, then try again.'
        : `Something went wrong: ${err.message}`,
      'assistant error'
    );
  } finally {
    typing.remove();
    isSending = false;
    updateSendState();
    chatInput.focus();
  }
}

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  sendMessage(chatInput.value);
});

// Enter sends, Shift+Enter adds a new line.
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    chatForm.requestSubmit();
  }
});

chatInput.addEventListener('input', () => {
  autoResize();
  updateSendState();
});

// Suggestion chips send their text as a question.
chips.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (chip) sendMessage(chip.textContent);
});

window.addEventListener('resize', autoResize);
