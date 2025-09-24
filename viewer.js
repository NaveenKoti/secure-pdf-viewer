// Read query params: ?pdf=URL&wm=watermarkText
const params = new URLSearchParams(window.location.search);
const pdfUrl = params.get('pdf') || 'pdfs/sample.pdf';
const watermarkText = params.get('wm') || ('Viewed: ' + new Date().toLocaleString());

// Setup PDF.js worker
const pdfjsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

const container = document.getElementById('viewerContainer');
const wm = document.getElementById('wm');

// Watermark simple repeated background using canvas pattern
(function createWatermark(){
  const c = document.createElement('canvas');
  c.width = 600; c.height = 200;
  const ctx = c.getContext('2d');
  ctx.translate(0,0);
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  ctx.font = '20px system-ui, Arial';
  ctx.translate(0, 80);
  ctx.rotate(-0.35);
  ctx.fillText(watermarkText, -50, 0);
  const dataUrl = c.toDataURL();
  wm.style.backgroundImage = `url(${dataUrl})`;
})();

// Render PDF pages to canvases
pdfjsLib.getDocument(pdfUrl).promise.then(pdf => {
  container.innerHTML = ''; // clear
  for (let p = 1; p <= pdf.numPages; p++) {
    pdf.getPage(p).then(page => {
      const viewport = page.getViewport({ scale: 1.3 });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      container.appendChild(canvas);
      page.render({ canvasContext: ctx, viewport: viewport });
    });
  }
}).catch(err => {
  container.textContent = 'Error loading PDF: ' + (err && err.message ? err.message : err);
});

// Basic browser hardening (not absolute)
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('copy', e => { e.preventDefault(); });
document.addEventListener('cut', e => { e.preventDefault(); });
document.addEventListener('selectstart', e => e.preventDefault());
window.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && ['c','x','s','p'].includes(e.key.toLowerCase())) e.preventDefault();
});

// Optional simple tracking ping (set TRACK_URL below to your webhook)
const TRACK_URL = ''; // e.g. https://script.google.com/macros/s/XYZ/exec
if (TRACK_URL) {
  try {
    navigator.sendBeacon(TRACK_URL + '?pdf=' + encodeURIComponent(pdfUrl) + '&wm=' + encodeURIComponent(watermarkText));
  } catch(e){}
}
