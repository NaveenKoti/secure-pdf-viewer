const params = new URLSearchParams(window.location.search);
const pdfUrl = params.get('pdf') || 'pdfs/doc1.pdf';
const watermarkText = params.get('wm') || ('Viewed on ' + new Date().toLocaleString());

// --- Configure PDF.js worker ---
const pdfjsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

// --- Viewer container and watermark target ---
const viewerContainer = document.getElementById('viewerContainer');
const watermarkLayer = document.getElementById('wm');

// --- Create and apply a watermark background ---
(function applyWatermark() {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 200;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  ctx.font = '20px system-ui, Arial';
  ctx.translate(0, 80);
  ctx.rotate(-0.35); // tilt text
  ctx.fillText(watermarkText, -50, 0);

  const pattern = canvas.toDataURL();
  watermarkLayer.style.backgroundImage = `url(${pattern})`;
})();

// --- Render all PDF pages into canvases ---
pdfjsLib.getDocument(pdfUrl).promise.then(pdf => {
  viewerContainer.innerHTML = ''; // clear previous content

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    pdf.getPage(pageNum).then(page => {
      const viewport = page.getViewport({ scale: 1.3 });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);

      viewerContainer.appendChild(canvas);

      page.render({ canvasContext: ctx, viewport });
    });
  }
}).catch(err => {
  viewerContainer.textContent = 'Failed to load PDF: ' +
    (err?.message || err);
});

// --- Basic content protection (not bulletproof) ---
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('copy', e => e.preventDefault());
document.addEventListener('cut', e => e.preventDefault());
document.addEventListener('selectstart', e => e.preventDefault());
window.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) &&
      ['c','x','s','p'].includes(e.key.toLowerCase())) {
    e.preventDefault();
  }
});

// --- Optional tracking ping (replace TRACK_URL with your endpoint) ---
const TRACK_URL = 'https://script.google.com/macros/s/AKfycbyFP945cfBDh3Vcd4Hb1Bui2DdMzRsnIPz5MvCYnZwWa5Md_whLzQ9hxgwqhuNwgIzcKQ/exec';
if (TRACK_URL) {
  try {
    navigator.sendBeacon(
      TRACK_URL +
      '?pdf=' + encodeURIComponent(pdfUrl) +
      '&wm=' + encodeURIComponent(watermarkText)
    );
  } catch (e) {
    console.warn('Tracking failed', e);
  }
}




