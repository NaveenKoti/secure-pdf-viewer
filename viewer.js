// CONFIG
const CLIENT_ID = '685997065527-ci6b8foh4seriikmktriej7va2gtrsva.apps.googleusercontent.com';
const DRIVE_FILE_ID = '1xE0DpapZFFP2oj9RGRjOOpKig1ULVl_P';
const SAMPLE_PDF_URL = 'pdfs/doc1.pdf';
const ACCESS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwbsAnUXtDLPY28RPx7IzJrivR21xWuiyMIVFEPue59JbdzA8Lu3ClD-N2qgY7mx5rr/exec';

const viewerContainer = document.getElementById('viewerContainer');
const progressLabel = document.getElementById('progress');

let userEmail = null;
let accessToken = null;
let pdfDoc = null;
let pagesRead = 0;

// PDF.js worker
const pdfjsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

// === Google Auth
let tokenClient;
function initAuth() {
  google.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback: handleCredentialResponse,
    ux_mode: 'popup'
  });
  google.accounts.id.renderButton(document.getElementById('gSignInButton'), { theme:'outline', size:'large' });

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/drive.readonly openid email',
    callback: resp => {
      if(resp.error) { console.error(resp.error); return; }
      accessToken = resp.access_token;
      onAuthReady();
    }
  });
}

// Google sign-in callback
function handleCredentialResponse(response){
  const payload = parseJwt(response.credential);
  userEmail = payload.email || 'Guest';
  tokenClient.requestAccessToken({ prompt:'consent' });
}

function parseJwt(token){
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g,'+').replace(/_/g,'/');
  return JSON.parse(decodeURIComponent(atob(base64).split('').map(c=> '%' + ('00'+c.charCodeAt(0).toString(16)).slice(-2)).join('')));
}

// === Check access & load PDF
function onAuthReady(){
  fetch(`${ACCESS_SCRIPT_URL}?action=checkAccess&email=${encodeURIComponent(userEmail)}&fileId=${DRIVE_FILE_ID}`)
    .then(r=>r.json())
    .then(res=>{
      if(res.status==='success' && res.hasAccess) loadPdfFromDrive();
      else showAccessDenied();
    }).catch(e=>{
      console.warn('Access check failed', e);
      loadPdf(SAMPLE_PDF_URL);
    });
}

// Load PDF from Drive
function loadPdfFromDrive(){
  const url = `https://www.googleapis.com/drive/v3/files/${DRIVE_FILE_ID}?alt=media`;
  fetch(url,{headers:{Authorization:'Bearer '+accessToken}})
    .then(r=>r.arrayBuffer())
    .then(ab=> renderPdfFromArrayBuffer(ab))
    .catch(e=>{
      console.warn('Drive PDF fetch failed', e);
      loadPdf(SAMPLE_PDF_URL);
    });
}

function loadPdf(url){
  pdfjsLib.getDocument(url).promise.then(pdf=> renderPdfDoc(pdf))
    .catch(e=> viewerContainer.textContent = 'Failed to load PDF: '+(e?.message||e));
}

function renderPdfFromArrayBuffer(ab){
  pdfjsLib.getDocument({data:new Uint8Array(ab)}).promise.then(pdf=> renderPdfDoc(pdf))
    .catch(e=> viewerContainer.textContent = 'Failed to parse PDF: '+e?.message);
}

// === Render PDF Pages
function renderPdfDoc(pdf){
  pdfDoc = pdf; pagesRead=0;
  viewerContainer.innerHTML='';
  progressLabel.textContent=`Page 0 of ${pdf.numPages}`;

  for(let i=1;i<=pdf.numPages;i++){
    pdf.getPage(i).then(page=> renderPage(page,i));
  }
}

function renderPage(page,pageNum){
  const viewport = page.getViewport({scale:1.2});
  const pageDiv = document.createElement('div'); pageDiv.className='pdf-page';

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height);
  pageDiv.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  viewerContainer.appendChild(pageDiv);

  const adDiv = document.createElement('div');
  adDiv.className='ad-slot'; adDiv.textContent='Ad Placeholder';
  pageDiv.appendChild(adDiv);

  page.render({canvasContext:ctx,viewport}).promise.then(()=>{
    drawWatermark(ctx,canvas.width,canvas.height);
    pagesRead=Math.max(pagesRead,pageNum);
    progressLabel.textContent=`Page ${pagesRead} of ${pdfDoc.numPages}`;
    sendProgress();
  });
}

function drawWatermark(ctx,width,height){
  const text = `${userEmail} | ${new Date().toLocaleString()}`;
  ctx.save(); ctx.fillStyle='rgba(0,0,0,0.25)';
  ctx.font='20px system-ui,Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
  const stepX=240,stepY=140;
  for(let y=0;y<height;y+=stepY){
    for(let x=0;x<width;x+=stepX){
      ctx.save();
      ctx.translate(x+stepX/2,y+stepY/2);
      ctx.rotate(-0.35);
      ctx.fillText(text,0,0);
      ctx.restore();
    }
  }
  ctx.restore();
}

// === Access Denied UI
function showAccessDenied(){
  viewerContainer.innerHTML=`
    <div style="padding:24px;text-align:center;">
      <h3>Access restricted</h3>
      <p>You don't have permission to view this PDF.</p>
      <button id="requestAccessBtn">Request Access</button>
      <div style="margin-top:12px;"><button id="viewSampleBtn">View Sample PDF</button></div>
    </div>
  `;
  document.getElementById('requestAccessBtn').onclick=()=>requestAccess();
  document.getElementById('viewSampleBtn').onclick=()=>loadPdf(SAMPLE_PDF_URL);
}

function requestAccess(){
  fetch(`${ACCESS_SCRIPT_URL}?action=requestAccess&fileId=${DRIVE_FILE_ID}&email=${encodeURIComponent(userEmail)}`)
    .then(r=>r.json())
    .then(res=>{ alert('Request submitted. Admin notified.'); loadPdf(SAMPLE_PDF_URL); })
    .catch(e=>{ alert('Request failed'); loadPdf(SAMPLE_PDF_URL); });
}

// === Progress Logging
function sendProgress(){
  if(!userEmail||!pdfDoc) return;
  fetch(ACCESS_SCRIPT_URL,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      email:userEmail,
      pdfUrl:`https://drive.google.com/file/d/${DRIVE_FILE_ID}/view`,
      pagesRead,
      totalPages:pdfDoc.numPages,
      timestamp:new Date().toISOString()
    })
  }).catch(e=>console.warn('progress log failed',e));
}

// === Anti-copy protections
document.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('copy',e=>e.preventDefault());
document.addEventListener('cut',e=>e.preventDefault());
document.addEventListener('selectstart',e=>e.preventDefault());
window.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&['c','x','s','p'].includes(e.key.toLowerCase())) e.preventDefault();
});

window.onload=()=>{ initAuth(); };
