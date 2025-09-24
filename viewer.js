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

// --- Function to render a single PDF page with repeated watermark ---
function renderPageWithWatermark(page, scale = 1.3) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  viewerContainer.appendChild(canvas);

  // Render PDF page
  page.render({ canvasContext: ctx, viewport }).promise.then(() => {
    // Create a small watermark pattern canvas
    const wmCanvas = document.createElement('canvas');
    wmCanvas.width = 300;
    wmCanvas.height = 150;
    const wmCtx = wmCanvas.getContext('2d');

    wmCtx.fillStyle = 'rgba(0,0,0,0.15)'; // darker watermark
    wmCtx.font = '24px system-ui, Arial';
    wmCtx.translate(wmCanvas.width / 2, wmCanvas.height / 2);
    wmCtx.rotate(-0.35);
    wmCtx.textAlign = 'center';
    wmCtx.textBaseline = 'middle';
    wmCtx.fillText(watermarkText, 0, 0);

    // Apply repeating pattern over entire PDF page
    const pattern = ctx.createPattern(wmCanvas, 'repeat');
    ctx.save();
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
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

// --- Basic content protection ---
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

// --- Optional tracking ping ---
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
