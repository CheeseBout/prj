const BACKEND_URL = "http://localhost:8000";
const FRONTEND_URL = "http://localhost:3000";
const PDF_TOGGLE_KEY = "pdfTranslationEnabled";
const PDF_VIEWER_PATH = "pdfjs/web/viewer.html";

let isPdfTranslationEnabled = false;

function isHttpUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (_error) {
    return false;
  }
}

function isLikelyPdfUrl(url) {
  if (!isHttpUrl(url)) return false;

  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();
    const fileQuery = (parsed.searchParams.get("file") || "").toLowerCase();

    return (
      pathname.endsWith(".pdf") ||
      pathname.includes("/pdf/") ||
      fileQuery.endsWith(".pdf")
    );
  } catch (_error) {
    return false;
  }
}

function buildPdfViewerUrl(pdfUrl) {
  return chrome.runtime.getURL(
    `${PDF_VIEWER_PATH}?file=${encodeURIComponent(pdfUrl)}`,
  );
}

function syncPdfToggleFromStorage() {
  chrome.storage.sync.get([PDF_TOGGLE_KEY], (result) => {
    isPdfTranslationEnabled = result[PDF_TOGGLE_KEY] === true;
  });
}

syncPdfToggleFromStorage();

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace !== "sync") return;
  if (changes[PDF_TOGGLE_KEY]) {
    isPdfTranslationEnabled = changes[PDF_TOGGLE_KEY].newValue === true;
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!isPdfTranslationEnabled) return;

  const candidateUrl = changeInfo.url || tab?.url;
  if (!candidateUrl) return;

  const viewerBase = chrome.runtime.getURL(PDF_VIEWER_PATH);
  if (candidateUrl.startsWith(viewerBase)) return;
  if (!isLikelyPdfUrl(candidateUrl)) return;

  chrome.tabs.update(tabId, { url: buildPdfViewerUrl(candidateUrl) });
});

const getCookie = (url, name) =>
  new Promise((resolve) => {
    chrome.cookies.get({ url, name }, (cookie) => resolve(cookie || null));
  });

const normalizeBearer = (rawValue) => {
  if (!rawValue) return null;
  let token = decodeURIComponent(rawValue).replace(/^"|"$/g, "");
  if (!token.startsWith("Bearer ")) {
    token = `Bearer ${token.replace(/^Bearer\s+/i, "")}`;
  }
  return token;
};

const readTokenCookie = async (cookieName) => {
  const primary = await getCookie(BACKEND_URL, cookieName);
  if (primary?.value) return primary.value;
  const fallback = await getCookie(FRONTEND_URL, cookieName);
  return fallback?.value || null;
};

const refreshAccessToken = async () => {
  const refreshTokenRaw = await readTokenCookie("refresh_token");
  const refreshToken = normalizeBearer(refreshTokenRaw);
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/refresh`, {
      method: "POST",
      headers: {
        Authorization: refreshToken,
      },
      credentials: "omit",
    });
    return response.ok;
  } catch {
    return false;
  }
};

const fetchWithAccessToken = async (request, accessTokenRaw) => {
  const accessToken = normalizeBearer(accessTokenRaw);
  if (!accessToken) {
    return { unauthorized: true, error: "Missing access token" };
  }

  const headers = {
    ...(request.options.headers || {}),
    Authorization: accessToken,
  };

  try {
    const response = await fetch(request.url, {
      method: request.options.method || "GET",
      headers,
      credentials: "omit",
      body: request.options.body ? JSON.stringify(request.options.body) : null,
    });

    if (response.status === 401) {
      return { unauthorized: true, response };
    }
    if (!response.ok) {
      return {
        error: `HTTP error! status: ${response.status}`,
      };
    }

    const data = await response.json();
    return { data };
  } catch (error) {
    return { error: error?.toString?.() || "Unknown fetch error" };
  }
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== "fetch_api") {
    return false;
  }

  (async () => {
    let accessTokenRaw = await readTokenCookie("access_token");
    if (!accessTokenRaw) {
      sendResponse({
        status: "error",
        error_type: "UNAUTHORIZED",
        message: "Missing access token cookie",
      });
      return;
    }

    let result = await fetchWithAccessToken(request, accessTokenRaw);
    if (result.unauthorized) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        sendResponse({
          status: "error",
          error_type: "UNAUTHORIZED",
          message: "Access token expired and refresh failed",
        });
        return;
      }

      accessTokenRaw = await readTokenCookie("access_token");
      if (!accessTokenRaw) {
        sendResponse({
          status: "error",
          error_type: "UNAUTHORIZED",
          message: "Missing refreshed access token",
        });
        return;
      }

      result = await fetchWithAccessToken(request, accessTokenRaw);
      if (result.unauthorized) {
        sendResponse({
          status: "error",
          error_type: "UNAUTHORIZED",
          message: "Token refresh did not restore authorization",
        });
        return;
      }
    }

    if (result.error) {
      sendResponse({
        status: "error",
        error_type: "UNKNOWN",
        message: result.error,
      });
      return;
    }

    sendResponse({ status: "success", data: result.data });
  })();

  return true;
});
