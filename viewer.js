const params = new URLSearchParams(window.location.search);
const pdfUrl = params.get('pdf') || 'pdfs/doc1.pdf';
const watermarkText = ('CIM College: ' + new Date().toLocaleString());

const pdfjsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

const viewerContainer = document.getElementById('viewerContainer');

// Draw repeated watermark on a canvas
function drawWatermark(ctx, width, height) {
  const text = watermarkText;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.font = '24px system-ui, Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const stepX = 250;
  const stepY = 150;
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

// Render a single PDF page with watermark and ad slot
function renderPageWithAd(page, scale = 1.3, pageNum = 1) {
  const viewport = page.getViewport({ scale });

  // Container for this page + ad
  const pageDiv = document.createElement('div');
  pageDiv.className = 'pdf-page';

  // Canvas for PDF page
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);

  pageDiv.appendChild(canvas);

  // Ad slot below canvas
  const adDiv = document.createElement('div');
  adDiv.className = 'ad-slot';
  adDiv.id = `ad-page-${pageNum}`;
  adDiv.textContent = 'Ad Placeholder – Replace with AdMob code';
  pageDiv.appendChild(adDiv);

  viewerContainer.appendChild(pageDiv);

  // Render PDF
  page.render({ canvasContext: ctx, viewport }).promise.then(() => {
    drawWatermark(ctx, canvas.width, canvas.height);
  });
}

// Render all pages
pdfjsLib.getDocument(pdfUrl).promise.then(pdf => {
  viewerContainer.innerHTML = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    pdf.getPage(i).then(page => renderPageWithAd(page, 1.3, i));
  }
}).catch(err => {
  viewerContainer.textContent = 'Failed to load PDF: ' + (err?.message || err);
});

// Basic content protection
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



