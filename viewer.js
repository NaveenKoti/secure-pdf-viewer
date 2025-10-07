/* viewer.js — Drive-authenticated PDF viewer with watermark, ads, progress, request-access */

// CONFIG - replace these
const CLIENT_ID = '685997065527-ci6b8foh4seriikmktriej7va2gtrsva.apps.googleusercontent.com';
const ACCESS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwbsAnUXtDLPY28RPx7IzJrivR21xWuiyMIVFEPue59JbdzA8Lu3ClD-N2qgY7mx5rr/exec';
const DRIVE_FILE_URL = 'https://drive.google.com/file/d/1xE0DpapZFFP2oj9RGRjOOpKig1ULVl_P/view';
const SAMPLE_PDF_URL = 'pdfs/doc1.pdf';
const ADMIN_EMAIL = 'naveenkoti@gmail.com';

// UI elements
const viewerContainer = document.getElementById('viewerContainer');
const progressLabel = document.getElementById('progress');

// state
let userEmail = null;
let accessToken = null;
let pdfDoc = null;
let pagesRead = 0;

// init PDF.js worker
const pdfjsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

// helper: extract Drive fileId
function extractDriveFileId(url) {
  const m = url.match(/[-\w]{25,}/);
  return m ? m[0] : null;
}

// === Google Identity + Token client setup ===
let tokenClient;
function initAuth() {
  // Render Google Sign-in button (ID token-based) to get basic profile
  google.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback: handleCredentialResponse,
    ux_mode: 'popup'
  });
  google.accounts.id.renderButton(document.getElementById('gSignInButton'), { theme: 'outline', size: 'large' });

  // Token client for Drive scopes (to fetch file bytes)
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/drive.readonly openid email',
    callback: (resp) => {
      if (resp.error) {
        console.error('Token client error', resp);
        return;
      }
      accessToken = resp.access_token;
      // we now have an access token — proceed to load file
      onAuthReady();
    }
  });
}

// Callback when google.accounts.id gives id_token (basic profile)
function handleCredentialResponse(response) {
  const payload = parseJwt(response.credential);
  userEmail = payload.email;
  // Now request an access token for Drive (popup consent)
  tokenClient.requestAccessToken({ prompt: 'consent' });
}

// parse JWT helper
function parseJwt (token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));
  return JSON.parse(jsonPayload);
}

// Called once we have accessToken (or for non-drive URLs)
function onAuthReady() {
  // Determine fileId and attempt to fetch file via Drive API
  const fileId = extractDriveFileId(DRIVE_FILE_URL);
  if (!fileId) {
    // not a Drive link — just load directly with PDF.js
    loadPdf(DRIVE_FILE_URL);
    return;
  }
  // Attempt to fetch bytes via Drive API using Authorization header
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  fetch(url, { headers: { Authorization: 'Bearer ' + accessToken } })
    .then(resp => {
      if (!resp.ok) {
        // not allowed — show sample and Request Access UI
        showAccessDenied(fileId);
        throw new Error('drive fetch failed: ' + resp.status);
      }
      return resp.arrayBuffer();
    })
    .then(ab => {
      // Render using PDF.js with arrayBuffer
      renderPdfFromArrayBuffer(ab);
    })
    .catch(err => {
      console.warn('Drive fetch error', err);
      // fallback sample
      loadPdf(SAMPLE_PDF_URL);
    });
}

// Load PDF from remote URL using PDF.js (simple)
function loadPdf(url) {
  pdfjsLib.getDocument(url).promise.then(pdf => {
    renderPdfDoc(pdf);
  }).catch(err => {
    viewerContainer.textContent = 'Failed to load PDF: ' + (err?.message || err);
  });
}

// Render PDF from arrayBuffer (Drive direct bytes)
function renderPdfFromArrayBuffer(ab) {
  pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise.then(pdf => {
    renderPdfDoc(pdf);
  }).catch(err => {
    viewerContainer.textContent = 'Failed to parse PDF: ' + err?.message;
  });
}

// Core rendering logic: per-page canvas + watermark + ad slot
function renderPdfDoc(pdf) {
  pdfDoc = pdf;
  pagesRead = 0;
  viewerContainer.innerHTML = '';
  progressLabel.textContent = `Page 0 of ${pdf.numPages}`;

  const renderPromises = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const prom = pdf.getPage(i).then(page => {
      const viewport = page.getViewport({ scale: 1.2 });
      const pageDiv = document.createElement('div');
      pageDiv.className = 'pdf-page';

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      pageDiv.appendChild(canvas);

      // ad slot
      const adDiv = document.createElement('div');
      adDiv.className = 'ad-slot';
      adDiv.textContent = 'Ad Placeholder — replace with AdMob';
      pageDiv.appendChild(adDiv);

      viewerContainer.appendChild(pageDiv);

      const ctx = canvas.getContext('2d');
      return page.render({ canvasContext: ctx, viewport }).promise.then(() => {
        // watermark on top
        drawRepeatedWatermark(ctx, canvas.width, canvas.height);
        // progress update
        pagesRead = Math.max(pagesRead, i);
        progressLabel.textContent = `Page ${pagesRead} of ${pdf.numPages}`;
        // optionally send progress to server (doPost)
        try { sendProgress(); } catch(e){ console.warn('progress send fail', e); }
      });
    });
    renderPromises.push(prom);
  }

  return Promise.all(renderPromises);
}

// Draw repeated watermark across canvas
function drawRepeatedWatermark(ctx, width, height) {
  const ts = new Date().toLocaleString();
  const text = `${userEmail || 'Guest'}  |  ${ts}`;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.font = '20px system-ui, Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const stepX = 240, stepY = 140;
  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      ctx.save();
      ctx.translate(x + stepX/2, y + stepY/2);
      ctx.rotate(-0.35);
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }
  }
  ctx.restore();
}

// Show Access Denied UI with "Request Access" button
function showAccessDenied(fileId) {
  viewerContainer.innerHTML = `
    <div style="padding:24px;text-align:center;">
      <h3>Access restricted</h3>
      <p>You don't have permission to view this PDF.</p>
      <button id="requestAccessBtn">Request Access</button>
      <div style="margin-top:12px;">
        <button id="viewSampleBtn">View Sample</button>
      </div>
    </div>
  `;
  document.getElementById('requestAccessBtn').onclick = () => {
    requestAccess(fileId);
  };
  document.getElementById('viewSampleBtn').onclick = () => {
    loadPdf(SAMPLE_PDF_URL);
  };
}

// Call Apps Script to log requestAccess (and send admin email)
function requestAccess(fileId) {
  const url = `${ACCESS_SCRIPT_URL}?action=requestAccess&fileId=${encodeURIComponent(fileId)}&email=${encodeURIComponent(userEmail||'unknown')}`;
  fetch(url).then(r => r.json()).then(res => {
    alert('Request submitted. Admin will be notified.');
    loadPdf(SAMPLE_PDF_URL);
  }).catch(e => {
    alert('Request failed; try again later.');
    loadPdf(SAMPLE_PDF_URL);
  });
}

// Optional: send progress to Apps Script (POST)
function sendProgress() {
  if (!userEmail || !pdfDoc) return;
  const payload = {
    email: userEmail,
    pdfUrl: DRIVE_FILE_URL,
    pagesRead: pagesRead,
    totalPages: pdfDoc.numPages,
    timestamp: new Date().toISOString()
  };
  fetch(ACCESS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(e=>console.warn('progress log failed', e));
}

// Basic anti-copy protections
document.addEventListener('contextmenu', e=>e.preventDefault());
document.addEventListener('copy', e=>e.preventDefault());
document.addEventListener('cut', e=>e.preventDefault());
document.addEventListener('selectstart', e=>e.preventDefault());
window.addEventListener('keydown', e => {
  if ((e.ctrlKey||e.metaKey) && ['c','x','s','p'].includes(e.key.toLowerCase())) e.preventDefault();
});

// INIT: wait for Google API to load and init
window.onload = () => {
  initAuth();
};
