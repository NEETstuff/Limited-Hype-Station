// View-only pointer machine for `/` (generative art). Drives the view transform
// on top of cached plates and owns the scanline clock. It never touches the
// seed, the plates, the stripe bits, or currentBits. Identity view
// (yaw=pitch=px=py=0) leaves the composite untouched. Compute and keys are
// brought by the operator or agent, never this host.
(function () {
  "use strict";

  var THRESH = 6; // CSS px: click-vs-drag threshold
  var YAW_MAX = 12; // deg
  var PITCH_MAX = 8; // deg
  var EASE_MS = 400; // ease back to identity on release
  var PARALLAX_PX = 4; // a few CSS px

  var config = null;
  var reducedMotion = false;
  var scanPeriodMs = 25000;

  // View transform state. Identity by default; composite short-circuits on it.
  var view = { yaw: 0, pitch: 0, px: 0, py: 0 };
  var easing = false;
  var easeStart = 0;
  var easeFrom = { yaw: 0, pitch: 0, px: 0, py: 0 };

  // Scanline clock (owned here so scrub can resume the period from a Y).
  var scanAnimStart = null;
  var scrubY = 0;

  // Gesture state.
  var activeId = null;
  var startX = 0;
  var startY = 0;
  var state = "idle"; // idle | pending | dragging-orbit | scrubbing-scan
  var dragged = false;
  var suppressClick = false;

  function now() {
    return typeof performance !== "undefined" && performance.now
      ? performance.now()
      : Date.now();
  }
  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  // --- View transform (polled by composite each frame) ---
  function getViewTransform() {
    if (reducedMotion) return { yaw: 0, pitch: 0, px: 0, py: 0 };
    if (easing) {
      var t = (now() - easeStart) / EASE_MS;
      if (t >= 1) {
        easing = false;
        view.yaw = view.pitch = view.px = view.py = 0;
      } else {
        var k = 1 - easeOutCubic(t);
        view.yaw = easeFrom.yaw * k;
        view.pitch = easeFrom.pitch * k;
        view.px = easeFrom.px * k;
        view.py = easeFrom.py * k;
      }
    }
    return { yaw: view.yaw, pitch: view.pitch, px: view.px, py: view.py };
  }

  function startEase() {
    easeFrom = { yaw: view.yaw, pitch: view.pitch, px: view.px, py: view.py };
    easeStart = now();
    easing = true;
  }

  // --- Scanline ---
  function getScan(ts, vpH) {
    if (reducedMotion) return vpH / 2;
    if (state === "scrubbing-scan") return scrubY;
    if (scanAnimStart === null) scanAnimStart = ts;
    var progress = ((((ts - scanAnimStart) / scanPeriodMs) % 1) + 1) % 1;
    return progress * vpH;
  }

  // Resume the period so it reads scanY at ts, then keeps looping.
  function resumeScanFrom(y, ts, vpH) {
    var targetProgress = vpH ? y / vpH : 0;
    scanAnimStart = ts - targetProgress * scanPeriodMs;
  }

  // --- Geometry / layout ---
  function geom() {
    return config && config.getGeometry ? config.getGeometry() : null;
  }

  function syncLayout() {
    var g = geom();
    if (!g || !config || !config.door) return;
    var size = Math.max(44, g.cellMin || 0);
    var d = config.door;
    d.style.width = size + "px";
    d.style.height = size + "px";
    d.style.left = g.starX + "px";
    d.style.top = g.starY + "px";
  }

  // Hottest bishop cell hit box (star-center is served by the #door element).
  function hitHot(cx, cy) {
    var g = geom();
    if (!g) return false;
    var size = Math.max(44, g.cellMin || 0);
    return (
      Math.abs(cx - g.hotX) <= size / 2 && Math.abs(cy - g.hotY) <= size / 2
    );
  }

  function navigate() {
    var href =
      config && config.door ? config.door.getAttribute("href") : null;
    window.location.href = href || "/desk.html";
  }

  // --- Pointer handlers (shared by canvas and #door) ---
  function onDown(e) {
    if (activeId !== null) return;
    activeId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    state = "pending";
    dragged = false;
    suppressClick = false;
    easing = false;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}
  }

  function onMove(e) {
    if (e.pointerId !== activeId) return;
    var dx = e.clientX - startX;
    var dy = e.clientY - startY;
    if (Math.hypot(dx, dy) < THRESH) return; // still a click-candidate
    dragged = true;
    if (reducedMotion) {
      // No orbit, parallax, or scrub. Just remember this was a drag so the
      // door's native click does not fire.
      suppressClick = true;
      return;
    }
    if (state === "pending") {
      state = Math.abs(dy) > Math.abs(dx) ? "scrubbing-scan" : "dragging-orbit";
      suppressClick = true;
    }
    if (state === "dragging-orbit") {
      easing = false;
      view.yaw = clamp(dx * 0.1, -YAW_MAX, YAW_MAX);
      view.pitch = clamp(dy * 0.1, -PITCH_MAX, PITCH_MAX);
      view.px = (view.yaw / YAW_MAX) * PARALLAX_PX;
      view.py = (view.pitch / PITCH_MAX) * PARALLAX_PX;
    } else if (state === "scrubbing-scan") {
      var vpH = window.innerHeight || 600;
      scrubY = clamp(e.clientY, 0, vpH);
    }
  }

  function onUp(e) {
    if (e.pointerId !== activeId) return;
    var dx = e.clientX - startX;
    var dy = e.clientY - startY;
    var dist = Math.hypot(dx, dy);
    var prev = state;
    finish(e);
    if (dist < THRESH) {
      // Click-candidate. Star-center taps are handled by the #door anchor's
      // native click; only the hottest bishop cell navigates from here.
      if (hitHot(e.clientX, e.clientY)) navigate();
      return;
    }
    if (prev === "dragging-orbit") startEase();
    else if (prev === "scrubbing-scan")
      resumeScanFrom(scrubY, now(), window.innerHeight || 600);
  }

  function onCancel(e) {
    if (e.pointerId !== activeId) return;
    var prev = state;
    finish(e);
    if (prev === "dragging-orbit") startEase();
    else if (prev === "scrubbing-scan")
      resumeScanFrom(scrubY, now(), window.innerHeight || 600);
  }

  function finish(e) {
    try {
      e.currentTarget.releasePointerCapture(activeId);
    } catch (_) {}
    activeId = null;
    state = "idle";
  }

  function onClick(e) {
    // Suppress the anchor's navigation only when the gesture was a drag, so
    // keyboard activation (Enter/Space) still opens the door.
    if (suppressClick) {
      e.preventDefault();
      suppressClick = false;
    }
  }

  function init(cfg) {
    config = cfg || {};
    reducedMotion = !!config.reducedMotion;
    scanPeriodMs = config.scanPeriodMs || 25000;
    var targets = [config.canvas, config.door];
    for (var i = 0; i < targets.length; i++) {
      var t = targets[i];
      if (!t) continue;
      t.addEventListener("pointerdown", onDown);
      t.addEventListener("pointermove", onMove);
      t.addEventListener("pointerup", onUp);
      t.addEventListener("pointercancel", onCancel);
      t.addEventListener("lostpointercapture", onCancel);
    }
    if (config.door) config.door.addEventListener("click", onClick);
    syncLayout();
  }

  window.FieldView = {
    init: init,
    syncLayout: syncLayout,
    getViewTransform: getViewTransform,
    getScan: getScan,
  };
})();
