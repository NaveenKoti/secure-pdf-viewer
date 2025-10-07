// CONFIGURATION
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
let lastPageViewed = 0;
let totalPages = 0;

// PDF.js setup
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

// ================ GOOGLE SIGN-IN ================
loginBtn.onclick = () => {
  showLoader("Redirecting to Google Sign-in...");
  const redirectUri = window.location.origin + window.location.pathname; // strict redirect
  const scope = 'openid email https://www.googleapis.com/auth/drive.readonly';
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=token&scope=${encodeURIComponent(scope)}&prompt=consent`;
  window.location.href = authUrl;
};

window.onload = async () => {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  accessToken = params.get('access_token');
  if (accessToken) {
    loginBtn.style.display = 'none';
    showLoader("Signing you in...");
    await fetchUserEmail();
    checkAccessAndLoad();
  } else hideLoader();
};

// ================ FETCH USER INFO ================
async function fetchUserEmail() {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: 'Bearer ' + accessToken }
    });
    const data = await res.json();
    userEmail = data.email;
  } catch (err) {
    userEmail = 'Guest';
  }
}

// ================ ACCESS CHECK ================
function checkAccessAndLoad() {
  showLoader("Verifying your access...");
  fetch(`${ACCESS_SCRIPT_URL}?action=checkAccess&email=${encodeURIComponent(userEmail)}&fileId=${DRIVE_FILE_ID}`)
    .then(r => r.json())
    .then(res => {
      hideLoader();
      if (res.status === 'success' && res.hasAccess) loadPdfFromDrive();
      else showAccessDenied();
    })
    .catch(e => {
      hideLoader();
      loadPdf(SAMPLE_PDF_URL);
    });
}

// ================ LOAD PDF ================
function loadPdfFromDrive() {
  showLoader("Loading your document...");
  const url = `https://www.googleapis.com/drive/v3/files/${DRIVE_FILE_ID}?alt=media`;
  fetch(url, { headers: { Authorization: 'Bearer ' + accessToken } })
    .then(r => r.arrayBuffer())
    .then(ab => {
      hideLoader();
      renderPdfFromArrayBuffer(ab);
    })
    .catch(() => {
      hideLoader();
      loadPdf(SAMPLE_PDF_URL);
    });
}

function loadPdf(url) {
  showLoader("Loading sample PDF...");
  pdfjsLib.getDocument(url).promise
    .then(pdf => {
      hideLoader();
      renderPdfDoc(pdf);
    })
    .catch(e => {
      hideLoader();
      viewerContainer.textContent = 'Failed to load PDF: ' + e.message;
    });
}

function renderPdfFromArrayBuffer(ab) {
  pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise
    .then(pdf => {
      hideLoader();
      renderPdfDoc(pdf);
    })
    .catch(e => {
      hideLoader();
      viewerContainer.textContent = 'Failed to parse PDF: ' + e.message;
    });
}

// ================ RENDER PDF PAGES ================
function renderPdfDoc(pdf) {
  pdfDoc = pdf;
  totalPages = pdf.numPages;
  viewerContainer.innerHTML = '';
  progressLabel.textContent = `Viewing 0 / ${totalPages} pages`;

  for (let i = 1; i <= totalPages; i++) {
    pdf.getPage(i).then(page => renderPage(page, i));
  }
}

function renderPage(page, pageNum) {
  const viewport = page.getViewport({ scale: 1.2 });
  const pageDiv = document.createElement('div');
  pageDiv.className = 'pdf-page';

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  pageDiv.appendChild(canvas);
  viewerContainer.appendChild(pageDiv);

  const adDiv = document.createElement('div');
  adDiv.className = 'ad-slot';
  adDiv.textContent = 'Ad Placeholder';
  pageDiv.appendChild(adDiv);

  page.render({ canvasContext: ctx, viewport }).promise.then(() => {
    drawWatermark(ctx, canvas.width, canvas.height);
    lastPageViewed = Math.max(lastPageViewed, pageNum);
    progressLabel.textContent = `Viewing ${lastPageViewed} / ${totalPages} pages`;
    sendProgress();
  });
}

// ================ WATERMARK ================
function drawWatermark(ctx, w, h) {
  const text = `${userEmail} | ${new Date().toLocaleString()}`;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.font = '20px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let y = 0; y < h; y += 140) {
    for (let x = 0; x < w; x += 240) {
      ctx.save();
      ctx.translate(x + 120, y + 70);
      ctx.rotate(-0.35);
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }
  }
  ctx.restore();
}

// ================ ACCESS DENIED ================
function showAccessDenied() {
  viewerContainer.innerHTML = `
    <div style="text-align:center; padding:24px;">
      <h3>Access restricted</h3>
      <p>You don't have permission to view this PDF.</p>
      <button id="requestAccessBtn">Request Access</button>
      <div style="margin-top:10px;">
        <button id="viewSampleBtn">View Sample PDF</button>
      </div>
    </div>`;
  document.getElementById('requestAccessBtn').onclick = requestAccess;
  document.getElementById('viewSampleBtn').onclick = () => loadPdf(SAMPLE_PDF_URL);
}

// ================ REQUEST ACCESS ================
function requestAccess() {
  showLoader("Requesting access...");
  fetch(`${ACCESS_SCRIPT_URL}?action=requestAccess&fileId=${DRIVE_FILE_ID}&email=${encodeURIComponent(userEmail)}`)
    .then(r => r.json())
    .then(() => {
      hideLoader();
      alert('Access request sent. Admin notified.');
      loadPdf(SAMPLE_PDF_URL);
    })
    .catch(() => {
      hideLoader();
      alert('Request failed.');
      loadPdf(SAMPLE_PDF_URL);
    });
}

// ================ LOGGING ================
function sendProgress() {
  if (!userEmail) return;
  fetch(ACCESS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: userEmail,
      fileId: DRIVE_FILE_ID,
      pageViewed: lastPageViewed,
      totalPages,
      timestamp: new Date().toISOString(),
      action: 'logAccess'
    })
  }).catch(e => console.warn('Log failed', e));
}

// ================ LOADER HANDLERS ================
function showLoader(msg = "Loading...") {
  loader.style.display = 'flex';
  loader.querySelector('p').textContent = msg;
}
function hideLoader() {
  loader.style.display = 'none';
}

// ================ DISABLE COPY ETC ================
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('copy', e => e.preventDefault());
document.addEventListener('cut', e => e.preventDefault());
document.addEventListener('selectstart', e => e.preventDefault());
window.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && ['c', 'x', 's', 'p'].includes(e.key.toLowerCase())) e.preventDefault();
});
