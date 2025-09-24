// --- Parse query parameters (?pdf=URL&wm=watermarkText) ---
const params = new URLSearchParams(window.location.search);
const pdfUrl = params.get('pdf') || 'pdfs/doc1.pdf';
const watermarkText = params.get('wm') || ('Viewed on ' + new Date().toLocaleString());

// --- Configure PDF.js worker ---
const pdfjsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

// --- Viewer container ---
const viewerContainer = document.getElementById('viewerContainer');

// --- Function to render a single PDF page with watermark ---
function renderPageWithWatermark(page, scale = 1.3) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  viewerContainer.appendChild(canvas);

  // Render the PDF page
  page.render({ canvasContext: ctx, viewport }).promise.then(() => {
    // Draw watermark on top
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);  // center
    ctx.rotate(-0.35);                                    // tilt text
    ctx.fillStyle = 'rgba(0,0,0,0.1)';                   // visible opacity
    ctx.font = '30px system-ui, Arial';
    ctx.fillText(watermarkText, -ctx.measureText(watermarkText).width / 2, 0);
    ctx.restore();
  });
}

// --- Render all PDF pages ---
pdfjsLib.getDocument(pdfUrl).promise.then(pdf => {
  viewerContainer.innerHTML = ''; // clear previous content
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    pdf.getPage(pageNum).then(page => renderPageWithWatermark(page));
  }
}).catch(err => {
  viewerContainer.textContent = 'Failed to load PDF: ' + (err?.message || err);
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

