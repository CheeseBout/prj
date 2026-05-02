import * as pdfjsLib from "../build/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = "../build/pdf.worker.min.mjs";

const viewerRoot = document.getElementById("viewerRoot");
const sourceUrlNode = document.getElementById("sourceUrl");
const scaleSelect = document.getElementById("scaleSelect");
const reloadBtn = document.getElementById("reloadBtn");
const pageTemplate = document.getElementById("pageTemplate");

let activePdfUrl = "";
let activeScale = Number(scaleSelect.value || 1.25);
let activeRenderEpoch = 0;
let activeLoadingTask = null;

function showMessage(message) {
  viewerRoot.innerHTML = "";
  const box = document.createElement("div");
  box.className = "viewer-message";
  box.textContent = message;
  viewerRoot.appendChild(box);
}

function getPdfUrlFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("file");
  if (!raw) {
    throw new Error('Missing "file" query parameter for PDF URL.');
  }

  const viewerUrlPrefix = chrome.runtime.getURL("pdfjs/web/viewer.html");
  if (raw.startsWith(viewerUrlPrefix)) {
    throw new Error("Invalid PDF URL.");
  }

  const parsed = new URL(raw);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error("Only http/https PDF URLs are supported.");
  }

  return parsed.href;
}

async function renderPage(pdfDoc, pageNumber, scale, renderEpoch) {
  if (renderEpoch !== activeRenderEpoch) return;

  const page = await pdfDoc.getPage(pageNumber);
  if (renderEpoch !== activeRenderEpoch) return;

  const viewport = page.getViewport({ scale });

  const node = pageTemplate.content.firstElementChild.cloneNode(true);
  const title = node.querySelector(".page-title");
  const stage = node.querySelector(".pdf-stage");
  const canvas = node.querySelector(".pdf-canvas");
  const textLayerEl = node.querySelector(".pdf-text-layer");

  title.textContent = `Trang ${pageNumber}`;

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  canvas.style.width = `${Math.ceil(viewport.width)}px`;
  canvas.style.height = `${Math.ceil(viewport.height)}px`;

  stage.style.width = `${Math.ceil(viewport.width)}px`;
  stage.style.height = `${Math.ceil(viewport.height)}px`;

  textLayerEl.style.width = `${Math.ceil(viewport.width)}px`;
  textLayerEl.style.height = `${Math.ceil(viewport.height)}px`;

  const context = canvas.getContext("2d", { alpha: false });
  await page.render({ canvasContext: context, viewport }).promise;
  if (renderEpoch !== activeRenderEpoch) return;

  const textContent = await page.getTextContent();
  if (renderEpoch !== activeRenderEpoch) return;

  const textLayer = new pdfjsLib.TextLayer({
    textContentSource: textContent,
    container: textLayerEl,
    viewport,
  });

  await textLayer.render();
  if (renderEpoch !== activeRenderEpoch) return;

  viewerRoot.appendChild(node);
}

async function renderDocument(scale) {
  if (!activePdfUrl) return;

  activeRenderEpoch += 1;
  const renderEpoch = activeRenderEpoch;

  if (activeLoadingTask) {
    try {
      await activeLoadingTask.destroy();
    } catch (_error) {
      // ignore
    }
    activeLoadingTask = null;
  }

  showMessage("Dang tai PDF...");

  const loadingTask = pdfjsLib.getDocument({
    url: activePdfUrl,
    withCredentials: false,
  });
  activeLoadingTask = loadingTask;

  let pdfDoc;
  try {
    pdfDoc = await loadingTask.promise;
  } finally {
    if (activeLoadingTask === loadingTask) {
      activeLoadingTask = null;
    }
  }

  if (renderEpoch !== activeRenderEpoch) return;
  viewerRoot.innerHTML = "";

  for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber += 1) {
    await renderPage(pdfDoc, pageNumber, scale, renderEpoch);
    if (renderEpoch !== activeRenderEpoch) return;
  }
}

async function bootstrap() {
  try {
    activePdfUrl = getPdfUrlFromQuery();
    sourceUrlNode.textContent = activePdfUrl;
    document.title = `PDF.js Viewer - ${activePdfUrl}`;
    await renderDocument(activeScale);
  } catch (error) {
    showMessage(`Khong the mo PDF: ${error.message}`);
  }
}

scaleSelect.addEventListener("change", async () => {
  const value = Number(scaleSelect.value);
  if (!Number.isFinite(value) || value <= 0) return;

  activeScale = value;
  await renderDocument(activeScale);
});

reloadBtn.addEventListener("click", async () => {
  await renderDocument(activeScale);
});

bootstrap();
