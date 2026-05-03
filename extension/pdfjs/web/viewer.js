import * as pdfjsLib from "../build/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = "../build/pdf.worker.min.mjs";

const viewerRoot = document.getElementById("viewerRoot");
const sourceUrlNode = document.getElementById("sourceUrl");
const scaleSelect = document.getElementById("scaleSelect");
const reloadBtn = document.getElementById("reloadBtn");
const openLocalPdfBtn = document.getElementById("openLocalPdfBtn");
const localPdfInput = document.getElementById("localPdfInput");
const pageTemplate = document.getElementById("pageTemplate");

let activePdfSource = null;
let activeScale = Number(scaleSelect.value || 1);
let activeRenderEpoch = 0;
let activeLoadingTask = null;
let resizeDebounceTimer = null;

function showMessage(message) {
  viewerRoot.innerHTML = "";
  const box = document.createElement("div");
  box.className = "viewer-message";
  box.textContent = message;
  viewerRoot.appendChild(box);
}

function setSourceLabel(value) {
  sourceUrlNode.textContent = value || "";
}

function parseRemotePdfUrlFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("file");
  if (!raw) return null;

  const viewerUrlPrefix = chrome.runtime.getURL("pdfjs/web/viewer.html");
  if (raw.startsWith(viewerUrlPrefix)) {
    throw new Error("Invalid PDF URL.");
  }

  const parsed = new URL(raw);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http/https PDF URLs are supported.");
  }

  return parsed.href;
}

function cleanupEmptyTextSpans(textLayerEl) {
  const spans = textLayerEl.querySelectorAll("span");
  for (const span of spans) {
    const content = span.textContent || "";
    if (!content.trim()) {
      span.remove();
    }
  }
}

function getDocumentSource() {
  if (!activePdfSource) return null;

  if (activePdfSource.kind === "remote") {
    return {
      url: activePdfSource.url,
      withCredentials: false,
    };
  }

  if (activePdfSource.kind === "local") {
    return {
      data: activePdfSource.data,
    };
  }

  return null;
}

function getFitWidthScale(page) {
  const baseViewport = page.getViewport({ scale: 1 });
  const availableWidth = Math.max(360, viewerRoot.clientWidth - 40);
  return availableWidth / baseViewport.width;
}

async function renderPage(pdfDoc, pageNumber, scaleMultiplier, renderEpoch) {
  if (renderEpoch !== activeRenderEpoch) return;

  const page = await pdfDoc.getPage(pageNumber);
  if (renderEpoch !== activeRenderEpoch) return;

  const fitScale = getFitWidthScale(page);
  const viewport = page.getViewport({ scale: fitScale * scaleMultiplier });

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

  // Append vào DOM TRƯỚC khi render canvas
  viewerRoot.appendChild(node);

  const context = canvas.getContext("2d", { alpha: false });
  // Nền trắng tường minh — fix dark mode render trắng
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: context, viewport }).promise;
  if (renderEpoch !== activeRenderEpoch) { node.remove(); return; }

  const textContent = await page.getTextContent();
  if (renderEpoch !== activeRenderEpoch) return;

  const textLayer = new pdfjsLib.TextLayer({
    textContentSource: textContent,
    container: textLayerEl,
    viewport,
  });

  await textLayer.render();
  if (renderEpoch !== activeRenderEpoch) return;

  cleanupEmptyTextSpans(textLayerEl);
}

async function renderDocument(scaleMultiplier) {
  const source = getDocumentSource();
  if (!source) {
    showMessage("Chon file PDF tu may hoac mo URL PDF de bat dau.");
    return;
  }

  source.cMapUrl = "https://unpkg.com/pdfjs-dist@latest/cmaps/"; 
  source.cMapPacked = true;
  source.standardFontDataUrl = "https://unpkg.com/pdfjs-dist@latest/standard_fonts/";

  activeRenderEpoch += 1;
  const renderEpoch = activeRenderEpoch;

  if (activeLoadingTask) {
    try {
      await activeLoadingTask.destroy();
    } catch (_error) {}
    activeLoadingTask = null;
  }

  showMessage("Dang tai PDF...");

  const loadingTask = pdfjsLib.getDocument(source);
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
    await renderPage(pdfDoc, pageNumber, scaleMultiplier, renderEpoch);
    if (renderEpoch !== activeRenderEpoch) return;
  }
}

async function useLocalPdfFile(file) {
  if (!file) return;

  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    showMessage("File khong hop le. Vui long chon file .pdf.");
    return;
  }

  const buffer = await file.arrayBuffer();
  activePdfSource = {
    kind: "local",
    name: file.name,
    data: new Uint8Array(buffer),
  };

  setSourceLabel(`Local: ${file.name}`);
  document.title = `PDF.js Viewer - ${file.name}`;
  await renderDocument(activeScale);
}

async function bootstrap() {
  try {
    const remoteUrl = parseRemotePdfUrlFromQuery();

    if (remoteUrl) {
      activePdfSource = { kind: "remote", url: remoteUrl };
      setSourceLabel(remoteUrl);
      document.title = `PDF.js Viewer - ${remoteUrl}`;
      await renderDocument(activeScale);
      return;
    }

    setSourceLabel("Chua chon PDF");
    showMessage("Bam 'Mo PDF tu may' de chon file PDF tu may tinh.");
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

openLocalPdfBtn.addEventListener("click", () => {
  localPdfInput.value = "";
  localPdfInput.click();
});

localPdfInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  await useLocalPdfFile(file);
});

window.addEventListener("resize", () => {
  if (!activePdfSource) return;
  clearTimeout(resizeDebounceTimer);
  resizeDebounceTimer = setTimeout(() => {
    renderDocument(activeScale);
  }, 150);
});

bootstrap();