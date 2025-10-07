// CONFIG
const CLIENT_ID = '685997065527-ci6b8foh4seriikmktriej7va2gtrsva.apps.googleusercontent.com';
const DRIVE_FILE_ID = '1xE0DpapZFFP2oj9RGRjOOpKig1ULVl_P';
const SAMPLE_PDF_URL = 'pdfs/doc1.pdf';
const ACCESS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwbsAnUXtDLPY28RPx7IzJrivR21xWuiyMIVFEPue59JbdzA8Lu3ClD-N2qgY7mx5rr/exec';

const viewerContainer = document.getElementById('viewerContainer');
const progressLabel = document.getElementById('progress');
const loginBtn = document.getElementById('loginBtn');
const loader = document.getElementById('loader');

let userEmail = null;
let accessToken = null;
let pdfDoc = null;
let pagesRead = 0;

// PDF.js worker
const pdfjsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

// ==========================
// GOOGLE OAUTH REDIRECT FLOW
// ==========================
loginBtn.onclick = () => {
  showLoader("Redirecting to Google Sign-in...");
  const redirectUri = window.location.href.split('#')[0];
  const scope = 'openid email https://www.googleapis.com/auth/drive.readonly';
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}` +
              `&redirect_uri=${encodeURIComponent(redirectUri)}` +
              `&response_type=token&scope=${encodeURIComponent(scope)}&prompt=consent`;
  window.location.href = url;
};

// On page load, check if token in URL
window.onload = async () => {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  accessToken = params.get('access_token');

  if (accessToken) {
    loginBtn.style.display = 'none'; // hide login button
    showLoader("Signing you in...");
    await fetchUserEmail();
    checkAccessAndLoad();
  } else {
    hideLoader();
  }
};

// ==========================
// Fetch user email
// ==========================
async function fetchUserEmail() {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { 'Authorization': 'Bearer ' + accessToken }
    });
    const data = await res.json();
    userEmail = data.email;
    console.log('Signed in as', userEmail);
  } catch (e) {
    console.warn('Failed to fetch email', e);
    userEmail = 'Guest';
  }
}

// ==========================
// ACCESS CHECK & PDF LOADING
// ==========================
function checkAccessAndLoad() {
  showLoader("Verifying your access...");
  fetch(`${ACCESS_SCRIPT_URL}?action=checkAccess&email=${encodeURIComponent(userEmail)}&fileId=${DRIVE_FILE_ID}`)
    .then(r => r.json())
    .then(res => {
      hideLoader();
      if(res.status==='success' && res.hasAccess) loadPdfFromDrive();
      else showAccessDenied();
    }).catch(e => {
      console.warn('Access check failed', e);
      hideLoader();
      loadPdf(SAMPLE_PDF_URL);
    });
}

// Load PDF from Drive
function loadPdfFromDrive() {
  showLoader("Loading your document...");
  const url = `https://www.googleapis.com/drive/v3/files/${DRIVE_FILE_ID}?alt=media`;
  fetch(url, { headers: { Authorization: 'Bearer ' + accessToken } })
    .then(r => r.arrayBuffer())
    .then(ab => {
      hideLoader();
      renderPdfFromArrayBuffer(ab);
    })
    .catch(e => {
      console.warn('Drive PDF fetch failed', e);
      hideLoader();
      loadPdf(SAMPLE_PDF_URL);
    });
}

// Load PDF from sample URL
function loadPdf(url) {
  showLoader("Loading sample PDF...");
  pdfjsLib.getDocument(url).promise.then(pdf => {
    hideLoader();
    renderPdfDoc(pdf);
  }).catch(e => {
    hideLoader();
    viewerContainer.textContent = 'Failed to load PDF: ' + (e?.message||e);
  });
}

function renderPdfFromArrayBuffer(ab) {
  pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise.then(pdf => {
    hideLoader();
    renderPdfDoc(pdf);
  }).catch(e => {
    hideLoader();
    viewerContainer.textContent = 'Failed to parse PDF: '+e?.message;
  });
}

// ==========================
// RENDER PDF PAGES
// ==========================
function renderPdfDoc(pdf) {
  pdfDoc = pdf;
  pagesRead = 0;
  viewerContainer.innerHTML = '';
  progressLabel.textContent = `Page 0 of ${pdf.numPages}`;

  for (let i = 1; i <= pdf.numPages; i++) {
    pdf.getPage(i).then(page => renderPage(page, i));
  }
}

function renderPage(page, pageNum) {
  const viewport = page.getViewport({ scale: 1.2 });
  const pageDiv = document.createElement('div');
  pageDiv.className = 'pdf-page';

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  pageDiv.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  viewerContainer.appendChild(pageDiv);

  const adDiv = document.createElement('div');
  adDiv.className = 'ad-slot';
  adDiv.textContent = 'Ad Placeholder';
  pageDiv.appendChild(adDiv);

  page.render({ canvasContext: ctx, viewport }).promise.then(() => {
    drawWatermark(ctx, canvas.width, canvas.height);
    pagesRead = Math.max(pagesRead, pageNum);
    progressLabel.textContent = `Page ${pagesRead} of ${pdfDoc.numPages}`;
    sendProgress();
  });
}

// Watermark
function drawWatermark(ctx, width, height) {
  const text = `${userEmail} | ${new Date().toLocaleString()}`;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.font = '20px system-ui,Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const stepX = 240, stepY = 140;
  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      ctx.save();
      ctx.translate(x + stepX / 2, y + stepY / 2);
      ctx.rotate(-0.35);
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }
  }
  ctx.restore();
}

// ==========================
// ACCESS DENIED & REQUEST
// ==========================
function showAccessDenied() {
  viewerContainer.innerHTML = `
    <div style="padding:24px;text-align:center;">
      <h3>Access restricted</h3>
      <p>You don't have permission to view this PDF.</p>
      <button id="requestAccessBtn">Request Access</button>
      <div style="margin-top:12px;"><button id="viewSampleBtn">View Sample PDF</button></div>
    </div>
  `;
  document.getElementById('requestAccessBtn').onclick = () => requestAccess();
  document.getElementById('viewSampleBtn').onclick = () => loadPdf(SAMPLE_PDF_URL);
}

function requestAccess() {
  showLoader("Requesting access...");
  fetch(`${ACCESS_SCRIPT_URL}?action=requestAccess&fileId=${DRIVE_FILE_ID}&email=${encodeURIComponent(userEmail)}`)
    .then(r => r.json())
    .then(res => { 
      hideLoader();
      alert('Request submitted. Admin notified.');
      loadPdf(SAMPLE_PDF_URL);
    })
    .catch(e => { 
      hideLoader();
      alert('Request failed');
      loadPdf(SAMPLE_PDF_URL); 
    });
}

// ==========================
// PROGRESS LOGGING
// ==========================
function sendProgress() {
  if(!userEmail || !pdfDoc) return;
  fetch(ACCESS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: userEmail,
      pdfUrl: `https://drive.google.com/file/d/${DRIVE_FILE_ID}/view`,
      pagesRead,
      totalPages: pdfDoc.numPages,
      timestamp: new Date().toISOString()
    })
  }).catch(e => console.warn('progress log failed', e));
}

// ==========================
// ANTI-COPY PROTECTIONS
// ==========================
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('copy', e => e.preventDefault());
document.addEventListener('cut', e => e.preventDefault());
document.addEventListener('selectstart', e => e.preventDefault());
window.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && ['c','x','s','p'].includes(e.key.toLowerCase())) e.preventDefault();
});

// ==========================
// LOADER FUNCTIONS
// ==========================
function showLoader(message = "Loading...") {
  loader.style.display = 'flex';
  loader.querySelector('p').textContent = message;
}

function hideLoader() {
  loader.style.display = 'none';
}
