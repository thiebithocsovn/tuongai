/* Choose a layout from the available width, with a phone fallback for embedded browsers. */
(function (root) {
  'use strict';
  function classify(input) {
    const width = Number(input.width) || 1024;
    const shortScreen = Math.min(Number(input.screenWidth) || width, Number(input.screenHeight) || width);
    const phone = !!input.mobile || (!!input.touch && shortScreen <= 600);
    const device = phone ? 'phone' : input.touch && shortScreen <= 1100 ? 'tablet' : 'desktop';
    const layout = phone || width <= 760 ? 'compact' : width <= 1100 ? 'medium' : 'wide';
    return { device, layout };
  }
  if (typeof module !== 'undefined') module.exports = { classify };
  if (!root.document) return;
  const document = root.document, html = document.documentElement;
  const viewport = document.querySelector('meta[name="viewport"]');
  let scheduled = false, correctedViewport = false;
  function sync() {
    scheduled = false;
    const navigator = root.navigator || {};
    const screen = root.screen || {};
    const touch = Number(navigator.maxTouchPoints) > 0 || !!root.matchMedia?.('(pointer: coarse)').matches;
    const mobile = navigator.userAgentData?.mobile === true || /Android.*Mobile|iPhone|iPod/i.test(navigator.userAgent || '');
    const width = html.clientWidth || root.innerWidth;
    const result = classify({ width, screenWidth: screen.width, screenHeight: screen.height, touch, mobile });
    html.dataset.device = result.device;
    html.dataset.layout = result.layout;
    // Some embedded/desktop-mode mobile browsers start at a 980px layout viewport.
    // Keep ordinary viewports and the user's ability to pinch zoom intact.
    const screenWidth = Number(screen.width);
    if (viewport && result.device === 'phone' && screenWidth > 0 && (correctedViewport || width > screenWidth * 1.3)) {
      const content = 'width=' + Math.round(screenWidth) + ',initial-scale=1,viewport-fit=cover';
      if (viewport.content !== content) viewport.content = content;
      correctedViewport = true;
    } else if (viewport && correctedViewport && result.device !== 'phone') {
      viewport.content = 'width=device-width,initial-scale=1,viewport-fit=cover';
      correctedViewport = false;
    }
    const visual = root.visualViewport;
    const height = visual && Math.abs(visual.scale - 1) < 0.01 ? visual.height : root.innerHeight;
    if (height > 0) html.style.setProperty('--device-height', Math.round(height) + 'px');
  }
  function schedule() {
    if (!scheduled) { scheduled = true; if (root.requestAnimationFrame) root.requestAnimationFrame(sync); else root.setTimeout(sync, 16); }
  }
  sync();
  root.addEventListener('resize', schedule, { passive: true });
  root.addEventListener('orientationchange', schedule, { passive: true });
  root.visualViewport?.addEventListener('resize', schedule, { passive: true });
  root.matchMedia?.('(pointer: coarse)').addEventListener?.('change', schedule);
})(typeof window !== 'undefined' ? window : globalThis);
