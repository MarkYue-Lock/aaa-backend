// ==========================================
// CONFIGURATION
// ==========================================
// Automatically detect if running locally or on the web
const IS_LOCAL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

// 1. IF LOCAL: Use your local Python server
// 2. IF PUBLIC: Use the Render.com URL (You will replace this later!)
const BASE_URL = IS_LOCAL 
    ? "http://127.0.0.1:5001" 
    : "https://PUT-YOUR-RENDER-URL-HERE.onrender.com"; 

const API_URL = `${BASE_URL}/api/chat-stream`;
const UPLOAD_URL = `${BASE_URL}/api/files/upload`; 

const MAX_EXCEL_SIZE_MB = 5; 
const TARGET_PAGE = "https://www.aaalendings.com/about.asp?id=11";
const FALLBACK_PDF = "https://aaalendings.com/RateSheet/Retail%20AAA%20Rates%2002.03.2026.pdf";

let greeted = false;
let conversationId = null;
let sessionId = localStorage.getItem('dify_session_id') || Math.random().toString(36).substring(2);
let selectedFile = null;
let currentMode = 'retail'; 

localStorage.setItem('dify_session_id', sessionId);

const messagesDiv = document.getElementById('messages');
const input = document.getElementById('input');
const excelInput = document.getElementById('excel-input');
const filePreviewArea = document.getElementById('file-preview-area');
const sendButton = document.getElementById('send-button');
const loadingIndicator = document.getElementById('loading-indicator');
const customSelect = document.getElementById('custom-select');

function toggleDropdown() {
    if(input.disabled) return; 
    customSelect.classList.toggle('open');
}

function selectMode(mode, element) {
    currentMode = mode;
    document.getElementById('current-mode-text').textContent = element.textContent;
    document.querySelectorAll('.custom-option').forEach(opt => opt.classList.remove('selected'));
    element.classList.add('selected');

    if (mode === 'homeport') {
        input.placeholder = "Ask About HomePort Qualification...";
        excelInput.click();
    } else {
        input.placeholder = "Ask About Retail Channel...";
        removeFile();
    }
    customSelect.classList.remove('open');
}

window.addEventListener('click', (e) => {
    if (!customSelect.contains(e.target)) customSelect.classList.remove('open');
});

excelInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        const file = e.target.files[0];
        if (!file.name.match(/\.(xlsx|xls)$/i)) {
            alert("Invalid file. Please upload an Excel file.");
            excelInput.value = ""; return;
        }
        if (file.size > MAX_EXCEL_SIZE_MB * 1024 * 1024) {
            alert(`Excel file size exceeds limit of ${MAX_EXCEL_SIZE_MB}MB.`);
            excelInput.value = ""; return;
        }
        selectedFile = file;
        renderFilePreview(selectedFile);
    }
});

function renderFilePreview(file) {
    filePreviewArea.style.display = 'block';
    filePreviewArea.innerHTML = `
        <div class="file-preview-item">
            <span class="material-symbols-outlined" style="font-size:18px;">table_view</span>
            <span>${file.name}</span>
            <span class="remove-file" onclick="removeFile()">×</span>
        </div>`;
}

function removeFile() {
    selectedFile = null;
    excelInput.value = "";
    filePreviewArea.style.display = 'none';
    filePreviewArea.innerHTML = "";
}

function setLoading(isLoading) {
  loadingIndicator.style.display = isLoading ? 'flex' : 'none';
  input.disabled = isLoading;
  customSelect.style.opacity = isLoading ? '0.6' : '1';
  if (!isLoading) input.focus();
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

async function loadDynamicPdf() {
    const statusText = document.getElementById('pdf-status-text');
    const setSrc = (url) => {
        document.getElementById('main-pdf-frame').src = url;
        document.getElementById('chat-pdf-frame').src = url;
        setTimeout(() => { document.getElementById('pdf-loading').style.display = 'none'; }, 1500);
    };
    try {
        statusText.textContent = "Connecting...";
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(TARGET_PAGE)}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error("Proxy failed");
        
        const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
        const pdfLink = Array.from(doc.querySelectorAll('a')).find(a => {
            const href = a.getAttribute('href'); 
            if (!href) return false;
            return /rates/i.test(href) && /\.pdf$/i.test(href);
        });

        if (pdfLink) {
            let finalUrl = pdfLink.getAttribute('href');
            if (!finalUrl.startsWith('http')) finalUrl = 'https://aaalendings.com/RateSheet/' + finalUrl.replace(/^\//, '');
            finalUrl = finalUrl.replace(/ /g, '%20');
            statusText.textContent = "Found latest sheet!";
            if(document.getElementById('chat-intro-text')) document.getElementById('chat-intro-text').textContent = "Hello! I am Lil A! Happy to help!";
            setSrc(finalUrl);
        } else { throw new Error("PDF not found"); }
    } catch (e) {
        statusText.textContent = "Loading cached version...";
        setSrc(FALLBACK_PDF);
    }
}
window.addEventListener('DOMContentLoaded', loadDynamicPdf);

function hideIntroBubble() { document.getElementById('chat-intro').style.display = 'none'; }
function openChat() {
  document.getElementById('full-pdf').style.display = 'none';
  document.getElementById('chatbot-overlay').style.display = 'flex';
  document.getElementById('chatbot-button').style.display = 'none';
  document.getElementById('chat-intro').style.display = 'none';
  if (!greeted) { addMessage("Hi, I’m Lil A. Ask me anything about Retail Ratesheet and Matrix!", "bot"); greeted = true; }
}
function closeChat() {
  document.getElementById('chatbot-overlay').style.display = 'none';
  document.getElementById('full-pdf').style.display = 'block';
  document.getElementById('chatbot-button').style.display = 'flex';
}

function addMessage(text, who) {
  const wrapper = document.createElement('div');
  wrapper.className = 'msg ' + who;
  const label = document.createElement('div');
  label.className = 'msg-label';
  label.textContent = who === 'user' ? 'You' : 'Lil A';
  wrapper.appendChild(label);
  const box = document.createElement('div');
  box.className = 'msg-box';
  if (who === 'user') box.textContent = text;
  else box.innerHTML = parseBotResponse(text);
  wrapper.appendChild(box);
  messagesDiv.appendChild(wrapper);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
  return box;
}

function parseBotResponse(text) {
    if (!text) return "";
    let processed = text;
    if (processed.includes('<think>')) {
        const parts = processed.split(/<\/?think>/);
        if(parts.length >= 3) processed = `<details><summary>Thought Process</summary>${marked.parse(parts[1])}</details>${parts[2]}`;
        else processed = `<details open><summary>Thinking...</summary>${marked.parse(parts[1]||'')}</details>`;
    }
    return marked.parse(processed.trim());
}

async function uploadFileToDify(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('user', sessionId);
    const response = await fetch(UPLOAD_URL, { method: 'POST', body: formData });
    if (!response.ok) throw new Error(`File upload failed: ${response.statusText}`);
    return await response.json();
}

async function send() {
    const text = input.value.trim();
    if (currentMode === 'homeport' && !selectedFile) {
        alert("Please attach an Excel file for HomePort Qualification.");
        return;
    }
    if (!text && !selectedFile) return;

    input.value = '';

    let userDisplayMsg = text;
    if (selectedFile) userDisplayMsg = `[Attached: ${selectedFile.name}] ` + text;
    addMessage(userDisplayMsg, 'user');
    
    setLoading(true);
    const botMsgBox = addMessage("", "bot"); 

    try {
        // ============================================================
        // BRANCH 1: HOMEPORT MODE
        // ============================================================
        if (currentMode === 'homeport') {
            botMsgBox.innerHTML = "<i>Analyzing Excel file via HomePort Engine...</i>";
            
            const formData = new FormData();
            formData.append('file', selectedFile);

            const response = await fetch(`${BASE_URL}/api/homeport/analyze`, { 
                method: 'POST', 
                body: formData 
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Analysis failed");
            }

            const reportText = await response.text();
            
            botMsgBox.innerHTML = `<pre style="white-space: pre-wrap; font-family: monospace; font-size: 12px;">${reportText}</pre>`;
            
            removeFile(); 
        } 
        
        // ============================================================
        // BRANCH 2: RETAIL MODE
        // ============================================================
        else {
            let uploadedFileId = null;
            if (selectedFile) {
                botMsgBox.innerHTML = "<i>Uploading Excel file...</i>";
                try {
                    const uploadResult = await uploadFileToDify(selectedFile);
                    uploadedFileId = uploadResult.id;
                    removeFile(); 
                } catch (uploadErr) {
                    botMsgBox.textContent = "Error uploading file: " + uploadErr.message;
                    setLoading(false);
                    return;
                }
            }

            const fileObject = uploadedFileId ? {
                "type": "document", "transfer_method": "local_file", "upload_file_id": uploadedFileId
            } : null;

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    inputs: { 
                        "query": text,
                        "Options": "Retail Channel", 
                        "file": fileObject
                    }, 
                    query: text,
                    response_mode: "streaming",
                    user: sessionId,
                    conversation_id: conversationId,
                    files: fileObject ? [fileObject] : []
                })
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullAnswer = "";
            let buffer = "";
            let streamEnded = false;

            while (!streamEnded) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); 

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.substring(6));
                            if (data.event === 'message' || data.event === 'agent_message') {
                                fullAnswer += data.answer;
                                botMsgBox.innerHTML = parseBotResponse(fullAnswer);
                                messagesDiv.scrollTop = messagesDiv.scrollHeight;
                            }
                            if (data.event === 'message_end' || data.event === 'workflow_finished') streamEnded = true;
                            if (data.conversation_id) conversationId = data.conversation_id;
                        } catch (e) { }
                    }
                }
            }
            reader.cancel();
        }

    } catch (err) {
        botMsgBox.textContent = "Error: " + err.message;
    } finally {
        setLoading(false);
    }
}
input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });

(function initResizer() {
  const resizer = document.getElementById('resizer');
  const pdfPane = document.getElementById('pdf-pane');
  const container = document.querySelector('.container');
  let isResizing = false;
  resizer.addEventListener('mousedown', () => { isResizing = true; resizer.classList.add('resizing'); document.body.style.cursor = 'ew-resize'; document.querySelectorAll('iframe').forEach(f=>f.style.pointerEvents='none'); });
  document.addEventListener('mousemove', e => { if(!isResizing)return; pdfPane.style.flex = `0 0 ${(e.clientX / container.getBoundingClientRect().width) * 100}%`; });
  document.addEventListener('mouseup', () => { isResizing = false; resizer.classList.remove('resizing'); document.body.style.cursor=''; document.querySelectorAll('iframe').forEach(f=>f.style.pointerEvents='auto'); });
})();

(function initDraggable() {
    const btn = document.getElementById('chatbot-button');
    let isDown = false, moved = false, offset = {x:0, y:0};
    btn.onmousedown = e => { isDown=true; moved=false; const rect = btn.getBoundingClientRect(); offset.x = e.clientX - rect.left; offset.y = e.clientY - rect.top; btn.style.transition='none'; };
    document.onmousemove = e => { if(!isDown)return; if(Math.hypot(e.movementX, e.movementY)>1) moved=true; btn.style.left=(e.clientX-offset.x)+'px'; btn.style.top=(e.clientY-offset.y)+'px'; };
    document.onmouseup = () => { if(isDown && !moved) openChat(); isDown=false; btn.style.transition='transform 0.2s'; };
})();