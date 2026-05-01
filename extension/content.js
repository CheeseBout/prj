(function () {
  "use strict";

  let currentCleanupFunction = null;

  const LOGIN_URL = "http://localhost:3000/login";
  let isExtensionEnabled = false;
  let isShowingLoginPrompt = false;

  function showLoginPrompt() {
    if (!isExtensionEnabled) return;
    if (isShowingLoginPrompt) return;
    isShowingLoginPrompt = true;

    const toast = document.createElement("div");
    toast.id = "ll-login-prompt-toast"; 
    toast.style.cssText = `
        position: fixed; bottom: 20px; right: 20px; background: #fff;
        border-left: 4px solid #f44336; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        padding: 16px 20px; border-radius: 4px; z-index: 2147483647;
        font-family: sans-serif; display: flex; flex-direction: column;
        gap: 10px; max-width: 300px;
    `;

    toast.innerHTML = `
        <div style="font-weight: bold; color: #333; font-size: 15px;">Chưa kết nối tài khoản</div>
        <div style="font-size: 13px; color: #666; line-height: 1.4;">
            Vui lòng đăng nhập vào hệ thống để đồng bộ từ vựng và sử dụng trợ lý dịch thuật.
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 5px;">
            <button id="ll-toast-close" style="background: transparent; border: none; color: #666; cursor: pointer; padding: 5px 10px;">Đóng</button>
            <button id="ll-toast-login" style="background: #1a73e8; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: 500;">Đăng nhập ngay</button>
        </div>
    `;

    document.body.appendChild(toast);

    document.getElementById("ll-toast-close").onclick = () => {
      toast.remove();
      isShowingLoginPrompt = false;
    };

    document.getElementById("ll-toast-login").onclick = () => {
      window.open(LOGIN_URL, "_blank");
      toast.remove();
      isShowingLoginPrompt = false;
    };

    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
        isShowingLoginPrompt = false;
      }
    }, 10000);
  }

  function switchMode(newMode, enabled = true) {
    isExtensionEnabled = enabled;
    const targetMode = newMode === "mode_inline" ? "mode_inline" : "mode_vocab";
    console.log(
      `[Extension] Trạng thái: ${enabled ? "BẬT" : "TẮT"} | Chế độ: ${targetMode}`,
    );

    if (!enabled) {
      const existingToast = document.getElementById("ll-login-prompt-toast");
      if (existingToast) {
        existingToast.remove();
      }
      isShowingLoginPrompt = false;
    }

    if (currentCleanupFunction) {
      currentCleanupFunction();
      currentCleanupFunction = null;
    }

    if (!enabled) return;

    if (targetMode === "mode_vocab") {
      currentCleanupFunction = initVocabularyMode();
    } else if (targetMode === "mode_inline") {
      currentCleanupFunction = initInlineTranslationMode();
    }
  }

  chrome.storage.sync.get(["translationMode", "extensionEnabled"], (result) => {
    const mode = result.translationMode || "mode_vocab";
    const enabled = result.extensionEnabled !== false;
    switchMode(mode, enabled);
  });

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "sync") {
      chrome.storage.sync.get(["translationMode", "extensionEnabled"], (result) => {
        const mode = result.translationMode || "mode_vocab";
        const enabled = result.extensionEnabled !== false;
        switchMode(mode, enabled);
      });
    }
  });

  chrome.runtime.onMessage.addListener((request) => {
    if (request && request.action === "switchMode") {
      switchMode(request.mode, request.enabled !== false);
    }
    if (request && request.action === "toggleExtension") {
      switchMode(request.mode, request.enabled);
    }
  });

  // =========================================================================
  // CHẾ ĐỘ 1: HỌC TỪ VỰNG 
  // =========================================================================
  function initVocabularyMode() {
    const API_ENDPOINT = "http://localhost:8000/api/scan";
    const UPDATE_PROGRESS_ENDPOINT = "http://localhost:8000/api/update-progress";
    const BATCH_TIMEOUT = 300;
    const MAX_BATCH_SIZE = 25;

    let pendingElements = [];
    let debounceTimer = null;
    let processedNodes = new WeakSet();
    const rangeDataMap = new Map();
    const nodeDataCache = new WeakMap();

    const tooltip = document.createElement("div");
    tooltip.id = "gap-assistant-tooltip";
    tooltip.style.cssText =
      "display:none; position:absolute; z-index:9999; background:white; border:1px solid #ccc; padding:15px; border-radius:8px; box-shadow:0 4px 6px rgba(0,0,0,0.1); width:250px;";
    document.body.appendChild(tooltip);

    const miniTooltip = document.createElement("div");
    miniTooltip.id = "mini-translate-btn";
    miniTooltip.innerHTML = "🪄 Dịch & Giải thích";
    miniTooltip.style.cssText =
      "display:none; position:absolute; z-index:9998; background:#1a73e8; color:white; padding:6px 10px; border-radius:4px; font-size:13px; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.2);";
    document.body.appendChild(miniTooltip);

    let currentManualRange = null;
    let currentManualText = "";

    const gapHighlight = new Highlight();
    if (CSS.highlights) {
      CSS.highlights.set("language-gap", gapHighlight);
    }

    function generateNodeId(node) {
      if (!node.hasAttribute("data-ll-vocab-id")) {
        node.setAttribute(
          "data-ll-vocab-id",
          "vocab-" + Math.random().toString(36).substr(2, 9) + "-" + Date.now()
        );
      }
      return node.getAttribute("data-ll-vocab-id");
    }

    function buildTextMapping(element) {
      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: function (node) {
            const parent = node.parentElement;
            if (parent && parent.closest("script, style, noscript")) {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          },
        },
        false,
      );

      let currentNode;
      let normalizedText = "";
      const map = [];
      let lastWasSpace = true;

      while ((currentNode = walker.nextNode())) {
        const text = currentNode.nodeValue;
        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          if (/\s/.test(char)) {
            if (!lastWasSpace) {
              normalizedText += " ";
              map.push({ node: currentNode, offset: i });
              lastWasSpace = true;
            }
          } else {
            normalizedText += char;
            map.push({ node: currentNode, offset: i });
            lastWasSpace = false;
          }
        }
      }

      if (lastWasSpace && normalizedText.length > 0) {
        normalizedText = normalizedText.slice(0, -1);
        map.pop();
      }

      return { text: normalizedText, map: map };
    }

    function applyHighlight(node, hlData) {
      if (!CSS.highlights) return;
      const { target_word, startIndex, endIndex } = hlData;
      const cachedData = nodeDataCache.get(node);

      if (
        !cachedData ||
        startIndex < 0 ||
        endIndex > cachedData.map.length ||
        startIndex >= endIndex
      )
        return;

      const map = cachedData.map;
      const startPos = map[startIndex];
      let endPos;

      if (endIndex < map.length) {
        endPos = map[endIndex];
      } else {
        const lastPos = map[map.length - 1];
        endPos = { node: lastPos.node, offset: lastPos.offset + 1 };
      }

      try {
        const range = new Range();
        range.setStart(startPos.node, startPos.offset);
        range.setEnd(endPos.node, endPos.offset);
        gapHighlight.add(range);
        rangeDataMap.set(range, hlData);
      } catch (e) {
        console.error("Lỗi tạo Range:", e);
      }
    }

    function hideTooltip() {
      tooltip.style.display = "none";
    }

    function getCaretRangeFromPoint(x, y) {
      if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x, y);
      if (document.caretPositionFromPoint) {
        const pos = document.caretPositionFromPoint(x, y);
        if (!pos) return null;
        const range = new Range();
        range.setStart(pos.offsetNode, pos.offset);
        range.setEnd(pos.offsetNode, pos.offset);
        return range;
      }
      return null;
    }

    function isPointInsideRange(pointRange, targetRange) {
      if (!pointRange || !targetRange) return false;
      try {
        return (
          targetRange.compareBoundaryPoints(Range.START_TO_START, pointRange) <= 0 &&
          targetRange.compareBoundaryPoints(Range.END_TO_END, pointRange) >= 0
        );
      } catch (_err) {
        return false;
      }
    }

    function showTooltip(x, y, hlData) {
      tooltip.style.left = `${x}px`;
      tooltip.style.top = `${y + 10}px`;
      tooltip.style.display = "block";

      const enExp = hlData.en_explanation
        ? `<div style="font-size: 13px; color: #424242; line-height: 1.4; margin-bottom: 6px;">${hlData.en_explanation}</div>`
        : "";
      const viExp = hlData.vi_explanation
        ? `<div style="font-size: 13px; color: #424242; line-height: 1.4; margin-bottom: 12px;">${hlData.vi_explanation}</div>`
        : "";

      tooltip.innerHTML = `
        <div style="font-weight: bold; color: #d84315; font-size: 16px;">${hlData.target_word}</div>
        <div style="margin: 6px 0; font-weight: 500; font-size: 14px; color: #1565c0;">📍 ${hlData.vietnamese_translation}</div>
        ${enExp}
        ${viExp}
        <button id="btn-mastered" data-word="${hlData.target_word}" style="background: #4caf50; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; width: 100%; box-sizing: border-box;">✓ Tôi đã hiểu từ này</button>
      `;

      const masteredButton = document.getElementById("btn-mastered");
      if (!masteredButton) return;
      masteredButton.onclick = async (event) => {
        const word = event.target.getAttribute("data-word");
        try {
          const response = await chrome.runtime.sendMessage({
            action: "fetch_api",
            url: UPDATE_PROGRESS_ENDPOINT,
            options: {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: { word: word, quality: 5 },
            },
          });

          if (response.status === "error" && response.error_type === "UNAUTHORIZED") {
            showLoginPrompt();
          } else {
            alert("Đã ghi nhận!");
          }
        } catch (error) {
          console.error("Lỗi:", error);
        }
        hideTooltip();
      };
    }

    const handleDocumentClick = (e) => {
      if (tooltip.contains(e.target)) return;
      const pointRange = getCaretRangeFromPoint(e.clientX, e.clientY);
      if (!pointRange) {
        hideTooltip();
        return;
      }
      for (const [range, data] of rangeDataMap.entries()) {
        if (isPointInsideRange(pointRange, range)) {
          showTooltip(e.pageX, e.pageY, data);
          return;
        }
      }
      hideTooltip();
    };

    const handleDocumentMouseUp = (e) => {
      if (miniTooltip.contains(e.target) || tooltip.contains(e.target)) return;
      const selection = window.getSelection();
      const text = selection.toString().trim();
      if (text.length > 0 && text.length < 100) {
        currentManualRange = selection.getRangeAt(0).cloneRange();
        currentManualText = text;
        const rect = currentManualRange.getBoundingClientRect();
        miniTooltip.style.left = `${rect.left + window.scrollX + rect.width / 2 - 50}px`;
        miniTooltip.style.top = `${rect.top + window.scrollY - 35}px`;
        miniTooltip.style.display = "block";
      } else {
        miniTooltip.style.display = "none";
      }
    };

    const handleDocumentMouseDown = (e) => {
      if (e.target !== miniTooltip) miniTooltip.style.display = "none";
    };

    const handleMiniTooltipMouseDown = (e) => e.preventDefault();

    const handleMiniTooltipClick = async (e) => {
      e.stopPropagation();
      miniTooltip.style.display = "none";
      if (!currentManualRange || !currentManualText) return;

      const word = currentManualText.replace(/\s+/g, " ").trim();
      const parentElement =
        currentManualRange.commonAncestorContainer.nodeType === 3
          ? currentManualRange.commonAncestorContainer.parentElement.closest("p, li, article, h1, h2, h3, span, div")
          : currentManualRange.commonAncestorContainer.closest("p, li, article, h1, h2, h3, span, div");

      if (!parentElement) return;

      let cachedData = nodeDataCache.get(parentElement);
      if (!cachedData) {
        cachedData = buildTextMapping(parentElement);
        nodeDataCache.set(parentElement, cachedData);
      }

      const context = cachedData.text;

      let startIndex = -1;
      for (let i = 0; i < cachedData.map.length; i++) {
        if (
          cachedData.map[i].node === currentManualRange.startContainer &&
          cachedData.map[i].offset === currentManualRange.startOffset
        ) {
          startIndex = i;
          break;
        }
      }

      if (startIndex === -1) startIndex = context.indexOf(word);
      if (startIndex === -1) return;

      const endIndex = startIndex + word.length;

      window.getSelection().removeAllRanges();
      showTooltip(e.pageX, e.pageY, {
        target_word: word,
        vietnamese_translation: "Đang dịch...",
        en_explanation: "Đang phân tích...",
        vi_explanation: "Đang phân tích...",
      });

      try {
        const response = await chrome.runtime.sendMessage({
          action: "fetch_api",
          url: "http://localhost:8000/api/translate-manual",
          options: {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: { word: word, context: context },
          },
        });

        if (response.status === "success") {
          const data = response.data;
          if (data.status === "success") {
            const hlData = {
              element_id: generateNodeId(parentElement),
              target_word: word,
              vietnamese_translation: data.vietnamese_translation,
              en_explanation: data.en_explanation,
              vi_explanation: data.vi_explanation,
              startIndex: startIndex,
              endIndex: endIndex,
            };
            applyHighlight(parentElement, hlData);
            showTooltip(e.pageX, e.pageY, hlData);
          }
        } else if (response.error_type === "UNAUTHORIZED") {
          showTooltip(e.pageX, e.pageY, {
            target_word: word,
            vietnamese_translation: "Yêu cầu đăng nhập",
            en_explanation: "Bạn cần đăng nhập để sử dụng tính năng này.",
            vi_explanation: "",
          });
          showLoginPrompt();
        } else {
          throw new Error(response.message);
        }
      } catch (error) {
        showTooltip(e.pageX, e.pageY, {
          target_word: word,
          vietnamese_translation: "Lỗi kết nối",
          en_explanation: "Kiểm tra Backend.",
          vi_explanation: "",
        });
      }
    };

    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("mouseup", handleDocumentMouseUp);
    document.addEventListener("mousedown", handleDocumentMouseDown);
    miniTooltip.addEventListener("mousedown", handleMiniTooltipMouseDown);
    miniTooltip.addEventListener("click", handleMiniTooltipClick);

    async function processBatch() {
      if (pendingElements.length === 0) return;
      const batchToSend = pendingElements.splice(0, MAX_BATCH_SIZE);
      const payload = {
        url: window.location.href,
        elements: batchToSend.map((item) => ({
          element_id: item.id,
          text_context: item.text,
        })),
      };

      try {
        const response = await chrome.runtime.sendMessage({
          action: "fetch_api",
          url: API_ENDPOINT,
          options: {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
          },
        });

        if (response.status === "success") {
          const data = response.data;
          if (data.status === "success" && data.highlights) {
            data.highlights.forEach((hlData) => {
              let targetNode = document.querySelector(`[data-ll-vocab-id="${hlData.element_id}"]`);
              if (!targetNode) {
                  const targetNodeObj = batchToSend.find((b) => b.id === hlData.element_id);
                  if (targetNodeObj && targetNodeObj.node) targetNode = targetNodeObj.node;
              }
              if (targetNode) applyHighlight(targetNode, hlData);
            });
          }
        } else if (response.error_type === "UNAUTHORIZED") {
          showLoginPrompt();
          pendingElements = [];
          return;
        }
      } catch (error) {}

      if (pendingElements.length > 0) setTimeout(processBatch, 100);
    }

    function queueElementForScan(node) {
      if (processedNodes.has(node)) return;
      const { text, map } = buildTextMapping(node);
      if (text.length < 20) return;

      processedNodes.add(node);
      nodeDataCache.set(node, { text, map });

      pendingElements.push({
        node: node,
        id: generateNodeId(node),
        text: text,
      });
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(processBatch, BATCH_TIMEOUT);
    }

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) queueElementForScan(entry.target);
        });
      },
      { rootMargin: "200px" },
    );

    const textTags = "p, li, article, h1, h2, h3, span";
    document
      .querySelectorAll(textTags)
      .forEach((node) => intersectionObserver.observe(node));

    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            if (node.matches && node.matches(textTags))
              intersectionObserver.observe(node);
            node
              .querySelectorAll(textTags)
              .forEach((childNode) => intersectionObserver.observe(childNode));
          }
        });
      });
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return function cleanup() {
      intersectionObserver.disconnect();
      mutationObserver.disconnect();
      clearTimeout(debounceTimer);

      document.removeEventListener("click", handleDocumentClick);
      document.removeEventListener("mouseup", handleDocumentMouseUp);
      document.removeEventListener("mousedown", handleDocumentMouseDown);
      miniTooltip.removeEventListener("mousedown", handleMiniTooltipMouseDown);
      miniTooltip.removeEventListener("click", handleMiniTooltipClick);

      hideTooltip();
      if (tooltip && tooltip.parentNode) tooltip.remove();
      if (miniTooltip && miniTooltip.parentNode) miniTooltip.remove();

      if (CSS.highlights && CSS.highlights.has("language-gap")) {
        CSS.highlights.get("language-gap").clear();
        CSS.highlights.delete("language-gap");
      }

      pendingElements = [];
      processedNodes = new WeakSet();
      rangeDataMap.clear();
      currentManualRange = null;
      currentManualText = "";
      
      document.querySelectorAll("[data-ll-vocab-id]").forEach(el => el.removeAttribute("data-ll-vocab-id"));

      console.log("[Extension] Đã dọn dẹp xong chế độ Học Từ Vựng.");
    };
  }

  // =========================================================================
  // CHẾ ĐỘ 2: DỊCH CHÈN DÒNG (INLINE) & BẢO TOÀN LINK (SPA SAFE)
  // =========================================================================
  function initInlineTranslationMode() {
    const CONFIG = {
      API_URL: "http://localhost:8000/api/scan-inline",
      OBSERVER_ROOT_MARGIN: "1500px 0px",
      BATCH_DELAY_MS: 400, // Đã tăng delay để gom nhóm tốt hơn
      MAX_BATCH_SIZE: 6,   // Giảm tải cho AI để tránh lỗi gộp câu
      TARGET_SELECTOR: "p, li, blockquote, dd, dt, h1, h2, h3, h4, h5, h6",
      HIGHLIGHT_NAME: "language-learning-highlight",
    };

    const observedElements = new WeakSet();
    const queuedElements = new Map();
    const processedElements = new Set();
    const textNodeCache = new Map();
    let batchTimer = null;
    let isFlushing = false; 

    const supportsHighlights =
      typeof CSS !== "undefined" &&
      CSS.highlights &&
      typeof Highlight !== "undefined";
    let highlightRegistry = supportsHighlights
      ? CSS.highlights.get(CONFIG.HIGHLIGHT_NAME)
      : null;
    if (supportsHighlights && !highlightRegistry) {
      highlightRegistry = new Highlight();
      CSS.highlights.set(CONFIG.HIGHLIGHT_NAME, highlightRegistry);
    }

    // Danh sách thẻ Block. Bất kỳ element nào chứa thẻ con thuộc list này đều KHÔNG phải là thẻ lá.
    const BLOCK_TAGS = new Set([
      'P', 'DIV', 'UL', 'OL', 'LI', 'SECTION', 'ARTICLE', 'BLOCKQUOTE', 
      'NAV', 'HEADER', 'FOOTER', 'TABLE', 'TR', 'TD', 'TH', 
      'MAIN', 'ASIDE', 'FIGURE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'
    ]);

    function isLeafBlock(element) {
        if (!element.matches(CONFIG.TARGET_SELECTOR)) return false;
        // Điểm mấu chốt chống bọc nhầm thẻ to: 
        // Nếu bản thân nó chứa thẻ con mang tính cấu trúc khối, nó sẽ bị bỏ qua và đi sâu xuống quét tiếp thẻ con.
        for (let i = 0; i < element.children.length; i++) {
            if (BLOCK_TAGS.has(element.children[i].tagName.toUpperCase())) {
                return false;
            }
        }
        return true;
    }

    function getOrAssignElementId(element) {
      if (!element.hasAttribute("data-ll-id")) {
        const uniqueId = "ll-" + Math.random().toString(36).substr(2, 9) + "-" + Date.now();
        element.setAttribute("data-ll-id", uniqueId);
      }
      return element.getAttribute("data-ll-id");
    }

    function buildTextNodeIndex(element) {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;
          if (
            parent &&
            parent.closest(
              "svg, canvas, math, .math, .mjx-chtml, img, picture, figure, figcaption, video, audio, iframe, object, embed",
            )
          )
            return NodeFilter.FILTER_REJECT;
          return node.nodeValue && node.nodeValue.trim().length
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        },
      });
      const map = [];
      let cursor = 0;
      let combinedText = "";
      
      while (walker.nextNode()) {
        const node = walker.currentNode;
        let value = node.nodeValue || "";
        
        // FIX Lỗi dính chữ: Tự động đệm khoảng trắng khi nối text giữa các Node riêng biệt
        if (combinedText.length > 0 && !combinedText.match(/[\s\n]$/) && !value.match(/^[\s\n]/)) {
            combinedText += " ";
            cursor += 1;
        }

        const start = cursor;
        const end = cursor + value.length;
        map.push({ node, start, end });
        combinedText += value;
        cursor = end;
      }
      return { map, text: combinedText };
    }

    function createRangeFromOffsets(elementId, startIndex, endIndex) {
      const nodeMap = textNodeCache.get(elementId);
      if (!nodeMap || !nodeMap.length) return null;
      let startPoint = null,
        endPoint = null;
      for (const part of nodeMap) {
        if (!startPoint && startIndex >= part.start && startIndex <= part.end)
          startPoint = { node: part.node, offset: startIndex - part.start };
        if (!endPoint && endIndex >= part.start && endIndex <= part.end)
          endPoint = { node: part.node, offset: endIndex - part.start };
        if (startPoint && endPoint) break;
      }
      if (!startPoint || !endPoint) return null;
      const range = new Range();
      range.setStart(startPoint.node, startPoint.offset);
      range.setEnd(endPoint.node, endPoint.offset);
      return range;
    }

    function getCleanedHTML(element) {
      const clone = element.cloneNode(true);
      
      const removeSelectors = "img, picture, figure, figcaption, svg, canvas, video, audio, iframe, object, embed, script, style, noscript";
      clone.querySelectorAll(removeSelectors).forEach(el => el.remove());

      clone.querySelectorAll("math, .math, .mjx-chtml, .mwe-math-wrapper").forEach((mathEl, index) => {
        mathEl.textContent = `__MATH_${index}__`;
      });

      const allElements = clone.querySelectorAll("*");
      for (const el of allElements) {
        const href = el.getAttribute("href");
        while (el.attributes.length > 0) {
            el.removeAttribute(el.attributes[0].name);
        }
        if (href) {
            el.setAttribute("href", href);
        }
      }
      
      return clone.innerHTML.trim();
    }

    function queueElementForScan(element) {
      if (element.closest(".ll-translatable, .ll-original, .ll-translation")) return;
      if (!isLeafBlock(element)) return; 
      
      const elementId = getOrAssignElementId(element);
      if (processedElements.has(elementId)) return;
      
      const { map, text } = buildTextNodeIndex(element);
      const fullText = text || "";
      if (fullText.trim().length < 2) return;

      let contextBefore = "";
      let contextAfter = "";
      if (element.previousElementSibling) {
        contextBefore = (element.previousElementSibling.textContent || "").trim().slice(-300);
      }
      if (element.nextElementSibling) {
        contextAfter = (element.nextElementSibling.textContent || "").trim().slice(0, 300);
      }

      textNodeCache.set(elementId, map);
      queuedElements.set(elementId, {
        element_id: elementId,
        text_context: fullText.slice(0, 4000),
        // FIX Lỗi AI trộn câu: Gói HTML Context vào màng bọc tĩnh để cách ly hoàn toàn
        html_context: `<div class="ll-isolate">${getCleanedHTML(element)}</div>`,
        context_before: contextBefore,
        context_after: contextAfter
      });

      if (batchTimer) clearTimeout(batchTimer);
      batchTimer = setTimeout(processBatchQueue, CONFIG.BATCH_DELAY_MS);
    }

    function applyHighlights(highlightItems) {
      if (!highlightRegistry || !Array.isArray(highlightItems)) return;
      for (const hit of highlightItems) {
        try {
          const { element_id, startIndex, endIndex } = hit;
          if (!element_id || typeof startIndex !== "number" || typeof endIndex !== "number" || endIndex <= startIndex)
            continue;
          const range = createRangeFromOffsets(element_id, startIndex, endIndex);
          if (range) highlightRegistry.add(range);
        } catch (error) {}
      }
    }

    function escapeRegExp(value) {
      return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function buildAnchorLookup(element) {
      const lookup = new Map();
      if (!(element instanceof Element)) return lookup;
      const anchors = element.querySelectorAll("a[href]");
      for (const anchor of anchors) {
        const rawText = (anchor.textContent || "").trim();
        if (!rawText) continue;
        const clone = anchor.cloneNode(true);
        clone.removeAttribute("id");
        if (!lookup.has(rawText)) lookup.set(rawText, clone.outerHTML);
      }
      return lookup;
    }

    function replaceTextWithAnchors(text, anchorLookup) {
      const keys = Array.from(anchorLookup.keys()).sort((a, b) => b.length - a.length);
      if (!keys.length || !text) return null;
      const pattern = new RegExp(keys.map(escapeRegExp).join("|"), "g");
      let match = null, lastIndex = 0;
      const fragment = document.createDocumentFragment();
      let hasReplacement = false;

      while ((match = pattern.exec(text)) !== null) {
        const [token] = match;
        const prevChar = match.index > 0 ? text[match.index - 1] : " ";
        const nextChar = match.index + token.length < text.length ? text[match.index + token.length] : " ";
        const isAlphanumeric = /[a-zA-Z0-9_]/;

        if (isAlphanumeric.test(prevChar) || isAlphanumeric.test(nextChar)) continue;
        hasReplacement = true;

        if (match.index > lastIndex)
          fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        
        const anchorTemplate = document.createElement("template");
        anchorTemplate.innerHTML = anchorLookup.get(token) || token;
        fragment.appendChild(anchorTemplate.content.cloneNode(true));
        lastIndex = match.index + token.length;
      }
      if (!hasReplacement) return null;
      if (lastIndex < text.length)
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
      return fragment;
    }

    function enrichTranslatedHtmlWithOriginalLinks(sourceElement, translatedHtml) {
      if (!(sourceElement instanceof Element)) return translatedHtml;
      const anchorLookup = buildAnchorLookup(sourceElement);
      if (!anchorLookup.size) return translatedHtml;

      const template = document.createElement("template");
      template.innerHTML = translatedHtml;
      const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
      const textNodes = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode);

      for (const textNode of textNodes) {
        const parent = textNode.parentElement;
        if (parent && parent.closest("a")) continue;
        const replaced = replaceTextWithAnchors(textNode.nodeValue || "", anchorLookup);
        if (replaced && textNode.parentNode)
          textNode.parentNode.replaceChild(replaced, textNode);
      }
      return template.innerHTML;
    }

    function applyTranslations(translations) {
      if (!Array.isArray(translations)) return;
      for (const item of translations) {
        const { element_id, translated_text } = item || {};
        if (!element_id || typeof translated_text !== "string" || !translated_text.trim()) continue;

        try {
          const el = document.querySelector(`[data-ll-id="${element_id}"]`);
          if (!el || !(el instanceof Element)) continue;

          if (el.classList.contains("ll-translatable")) {
            const existing = el.querySelector(":scope > .ll-translation");
            if (existing) {
                // Parse màng bọc do LLM trả về nếu có
                let updatedHtml = translated_text;
                const match = updatedHtml.match(/<div class="ll-isolate">([\s\S]*?)<\/div>/i);
                if (match) updatedHtml = match[1].trim();
                existing.innerHTML = updatedHtml;
            }
            continue;
          }

          let translatedHtml = translated_text;
          const isolateMatch = translatedHtml.match(/<div class="ll-isolate">([\s\S]*?)<\/div>/i);
          if (isolateMatch) {
              translatedHtml = isolateMatch[1].trim();
          }

          translatedHtml = enrichTranslatedHtmlWithOriginalLinks(el, translatedHtml);

          const originalMaths = el.querySelectorAll("math, .math, .mjx-chtml, .mwe-math-wrapper");
          originalMaths.forEach((mathEl, index) => {
             const marker = `__MATH_${index}__`;
             const regex = new RegExp(`<math[^>]*>${marker}<\\/math>|${marker}`, 'g');
             translatedHtml = translatedHtml.replace(regex, mathEl.outerHTML);
          });

          el.classList.add("ll-translatable");

          const computedStyle = window.getComputedStyle(el);
          el.style.setProperty("--ll-fs", computedStyle.fontSize);
          el.style.setProperty("--ll-lh", computedStyle.lineHeight);
          
          // FIX Lỗi chữ bị tàng hình: Dò ngược DOM để bắt màu an toàn, thay vì lấy mã transparent
          let safeColor = 'inherit';
          let currentEl = el;
          while (currentEl && currentEl.nodeType === 1) {
              const col = window.getComputedStyle(currentEl).color;
              if (col && col !== 'rgba(0, 0, 0, 0)' && col !== 'transparent') {
                  safeColor = col;
                  break;
              }
              currentEl = currentEl.parentElement;
          }
          el.style.setProperty("--ll-color", safeColor);

          const translationWrapper = document.createElement("span");
          translationWrapper.className = "ll-translation";
          translationWrapper.innerHTML = translatedHtml;

          el.appendChild(translationWrapper);

          if (!el._llClickHandler) {
            el._llClickHandler = function (e) {
              if (e.target.closest("a")) return;
              const selection = window.getSelection();
              if (selection && selection.toString().trim().length > 0) return;

              if (el._clickTimer) {
                clearTimeout(el._clickTimer);
                el._clickTimer = null;
                return;
              }
              el._clickTimer = setTimeout(() => {
                el._clickTimer = null;
                el.classList.toggle("ll-showing-translation");
              }, 250);
            };
            el.addEventListener("click", el._llClickHandler);
          }
        } catch (error) {}
      }
    }

    async function processBatchQueue() {
      if (isFlushing || queuedElements.size === 0) return;
      isFlushing = true;

      while (queuedElements.size > 0) {
        const batchKeys = Array.from(queuedElements.keys()).slice(0, CONFIG.MAX_BATCH_SIZE);
        const payloadElements = batchKeys.map((key) => queuedElements.get(key));

        for (const key of batchKeys) {
          processedElements.add(key);
          queuedElements.delete(key);
        }

        try {
          const response = await chrome.runtime.sendMessage({
            action: "fetch_api",
            url: CONFIG.API_URL,
            options: {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: {
                url: window.location.href,
                elements: payloadElements,
              },
            },
          });

          if (response.status !== "success") {
            if (response.error_type === "UNAUTHORIZED") {
              console.warn("[LL Scanner] Dừng scan vì chưa đăng nhập (401)");
              showLoginPrompt();
              break; 
            }
            continue; 
          }

          const data = response.data;
          const responseData = Array.isArray(data) ? data : data.highlights || [];
          const translationData = Array.isArray(data) ? data : data.translations || [];

          applyHighlights(responseData);
          applyTranslations(translationData);
          
          await new Promise(resolve => setTimeout(resolve, 300)); 

        } catch (error) {
          console.warn("[LL Scanner] API unavailable", error);
        }
      }

      isFlushing = false;
    }

    function observeCandidate(element, intersectionObserver) {
      if (!(element instanceof Element)) return;
      if (element.closest(".ll-translatable, .ll-original, .ll-translation")) return;
      if (!isLeafBlock(element)) return;
      if (observedElements.has(element)) return;

      observedElements.add(element);
      intersectionObserver.observe(element);
    }

    function observeTextElementsInSubtree(root, intersectionObserver) {
      if (!(root instanceof Element || root instanceof Document)) return;
      if (root instanceof Element) observeCandidate(root, intersectionObserver);
      const matches = root.querySelectorAll ? root.querySelectorAll(CONFIG.TARGET_SELECTOR) : [];
      for (const element of matches) observeCandidate(element, intersectionObserver);
    }

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          queueElementForScan(entry.target);
          intersectionObserver.unobserve(entry.target);
        }
      },
      { root: null, rootMargin: CONFIG.OBSERVER_ROOT_MARGIN, threshold: 0 },
    );

    observeTextElementsInSubtree(document, intersectionObserver);

    const mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          observeTextElementsInSubtree(node, intersectionObserver);
        }
      }
    });

    if (document.body) {
      mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }

    const handleBeforeUnload = () => {
      intersectionObserver.disconnect();
      mutationObserver.disconnect();
      if (batchTimer) clearTimeout(batchTimer);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return function cleanup() {
      intersectionObserver.disconnect();
      mutationObserver.disconnect();
      if (batchTimer) clearTimeout(batchTimer);

      window.removeEventListener("beforeunload", handleBeforeUnload);

      if (CSS.highlights && CSS.highlights.has(CONFIG.HIGHLIGHT_NAME)) {
        CSS.highlights.get(CONFIG.HIGHLIGHT_NAME).clear();
      }

      document.querySelectorAll(".ll-translatable").forEach((el) => {
        if (el._llClickHandler) {
          el.removeEventListener("click", el._llClickHandler);
          delete el._llClickHandler;
        }
        if (el._clickTimer) {
          clearTimeout(el._clickTimer);
          delete el._clickTimer;
        }

        el.classList.remove("ll-translatable", "ll-showing-translation");
        el.style.removeProperty("--ll-fs");
        el.style.removeProperty("--ll-lh");
        el.style.removeProperty("--ll-color");

        const translationWrapper = el.querySelector(":scope > .ll-translation");
        if (translationWrapper) {
          el.removeChild(translationWrapper);
        }
      });
      
      document.querySelectorAll("[data-ll-id]").forEach(el => el.removeAttribute("data-ll-id"));

      queuedElements.clear();
      processedElements.clear();
      textNodeCache.clear();

      console.log("[Extension] Đã dọn dẹp xong chế độ Inline.");
    };
  }
})();