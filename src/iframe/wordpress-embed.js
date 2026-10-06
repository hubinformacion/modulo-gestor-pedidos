(function () {
  function connect(frame) {
    if (frame.dataset.fecConnected) return;
    frame.dataset.fecConnected = "true";
    var base = new URL(frame.src, window.location.href);
    var origin = base.origin;
    var timer = 0;
    var attempts = 0;
    var receivedHeight = false;
    frame.style.setProperty("width", "100%", "important");
    frame.style.setProperty("max-width", "100%", "important");
    frame.style.setProperty("display", "block");
    frame.style.setProperty("max-height", "none", "important");
    frame.style.setProperty("min-height", "0", "important");
    frame.style.setProperty("aspect-ratio", "auto", "important");
    function initialize() {
      if (!frame.isConnected || receivedHeight || attempts >= 10) return;
      attempts += 1;
      frame.contentWindow.postMessage({ type: "fec:iframe:init", version: 1 }, origin);
      timer = window.setTimeout(initialize, 1000);
    }
    function reconnect() {
      window.clearTimeout(timer); attempts = 0; receivedHeight = false; initialize();
    }
    function receive(event) {
      if (event.origin !== origin || event.source !== frame.contentWindow) return;
      var data = event.data;
      if (!data || data.version !== 1) return;
      if (data.type === "fec:iframe:ready") { reconnect(); return; }
      if (data.type !== "fec:iframe:height" || !Number.isInteger(data.height) || data.height < 128 || data.height > 100000) return;
      receivedHeight = true;
      window.clearTimeout(timer);
      frame.style.setProperty("height", data.height + "px", "important");
      frame.dispatchEvent(new CustomEvent("fec:iframe:resized", { detail: { height: data.height } }));
    }
    function openTracking() {
      if (base.pathname.replace(/\/$/, "") !== "/pedido") return;
      var match = window.location.hash.match(/^#seguimiento\/([A-Za-z0-9_-]{32})$/);
      if (!match) return;
      var target = new URL("/seguimiento/" + match[1], origin);
      if (frame.src !== target.href) frame.src = target.href;
    }
    window.addEventListener("message", receive);
    window.addEventListener("hashchange", openTracking);
    frame.addEventListener("load", reconnect);
    openTracking(); initialize();
  }
  function mount() { document.querySelectorAll("iframe[data-fec-iframe]").forEach(connect); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
})();
