(function () {
  const script = document.currentScript;
  const apiKey = script.getAttribute("data-api-key") || "";
  const baseUrl = script.src.replace(/\/widget\.js.*$/, "");

  let backdrop = null;

  function createOverlay() {
    backdrop = document.createElement("div");
    Object.assign(backdrop.style, {
      position: "fixed",
      inset: "0",
      background: "rgba(0,0,0,0.5)",
      zIndex: "2147483646",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      visibility: "hidden",
      pointerEvents: "none",
    });

    const closeBtn = document.createElement("button");
    Object.assign(closeBtn.style, {
      position: "absolute",
      top: "16px",
      right: "16px",
      background: "white",
      border: "none",
      borderRadius: "50%",
      width: "32px",
      height: "32px",
      cursor: "pointer",
      fontSize: "20px",
      lineHeight: "32px",
      textAlign: "center",
      zIndex: "2147483647",
      boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
    });
    closeBtn.textContent = "\u00d7";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.onclick = close;

    const iframe = document.createElement("iframe");
    iframe.src = baseUrl + "/widget?key=" + encodeURIComponent(apiKey);
    Object.assign(iframe.style, {
      width: "min(480px, calc(100vw - 32px))",
      height: "min(620px, calc(100vh - 64px))",
      border: "none",
      borderRadius: "16px",
      background: "white",
      boxShadow: "0 24px 64px rgba(0,0,0,0.2)",
    });

    backdrop.appendChild(closeBtn);
    backdrop.appendChild(iframe);
    document.body.appendChild(backdrop);
  }

  function open() {
    if (!backdrop) createOverlay();
    backdrop.style.visibility = "visible";
    backdrop.style.pointerEvents = "auto";
  }

  function close() {
    if (!backdrop) return;
    backdrop.style.visibility = "hidden";
    backdrop.style.pointerEvents = "none";
  }

  // Close when interview completes
  window.addEventListener("message", function (e) {
    if (e.data && e.data.type === "lastword:done") {
      close();
    }
  });

  // Close on backdrop click (outside the iframe)
  document.addEventListener("click", function (e) {
    if (backdrop && e.target === backdrop) close();
  });

  window.LastWord = { open: open, close: close };

  // Preload: inject hidden iframe immediately so it boots while the user
  // is still on the cancellation page — by the time they open the widget
  // the AI greeting is already loading or done.
  if (document.body) {
    createOverlay();
  } else {
    document.addEventListener("DOMContentLoaded", createOverlay);
  }
})();
