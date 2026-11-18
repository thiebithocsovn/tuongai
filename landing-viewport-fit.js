/* Responsive landing viewport fitting. Login functionality is deliberately unchanged. */
(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;
  const STYLE_TEXT = "\n/* Landing only. Keep teacher, administrator and student layouts untouched. */\n#auth{\n  display:flex;flex-direction:column;align-items:center;justify-content:center;\n  box-sizing:border-box;min-height:var(--device-height,100dvh);\n  padding-top:clamp(10px,1.8vh,22px);\n  padding-bottom:clamp(9px,1.7vh,20px);\n  overflow:visible;\n}\nbody.has-sbar #auth{min-height:calc(var(--device-height,100dvh) - var(--sbh,0px))}\n#auth>.auth-wrap,#auth>.install-panel,#auth>.auth-metrics-wrap{flex-shrink:0}\n#auth .auth-wrap{margin-inline:auto}\n#auth .install-panel,#auth .auth-metrics-wrap{margin-left:auto;margin-right:auto}\n@media (min-width:901px) and (max-height:850px){\n  #auth .auth-wrap{gap:clamp(16px,2.3vw,32px)}\n  #auth .auth-hero{gap:clamp(6px,1.05vh,12px)}\n  #auth .auth-hero .brand .owl{width:48px;height:48px}\n  #auth .auth-hero .brand b{font-size:19px}\n  #auth .auth-hero h1{font-size:clamp(28px,3vw,39px);line-height:1.08}\n  #auth .auth-hero .lede{font-size:clamp(13px,1.05vw,15.5px);line-height:1.4}\n  #auth .points{gap:5px}\n  #auth .points li{font-size:clamp(12px,1vw,14px);line-height:1.35}\n  #auth .points .dot{width:23px;height:23px}\n  #auth .paper{padding:10px 14px 10px 38px}\n  #auth .paper p{font-size:18px;line-height:23px}\n  #auth .paper .note{font-size:14px}\n  #auth .paper .stamp{width:54px;height:54px;font-size:27px}\n  #auth .paper .stamp small{font-size:12px}\n  #auth .auth-card{padding:clamp(12px,1.5vw,18px)}\n  #auth .tabs{margin-bottom:8px}\n  #auth .tabs button{min-height:34px;font-size:14px}\n  #auth .auth-for{font-size:12px;line-height:1.4;margin:-3px 0 9px}\n  #auth .form{gap:8px}\n  #auth .fld{gap:4px}\n  #auth .fld>span{font-size:12px}\n  #auth .fld input:not([type=checkbox]):not([type=radio]){min-height:36px;padding:7px 10px;font-size:14px}\n  #auth .form>.btn{min-height:36px}\n  #auth .chk,#auth .switch{font-size:12px}\n  #auth .store-note{font-size:11px}\n  #auth .install-panel{margin-top:9px;padding:8px 10px}\n  #auth .install-panel-top{gap:8px}\n  #auth .install-platform{min-height:39px;padding:5px 7px}\n  #auth .install-panel-head p{font-size:11px}\n  #auth .install-panel h2{font-size:13px}\n  #auth .auth-metrics-wrap{margin-top:8px;margin-bottom:0}\n  #auth .auth-metrics-top{margin-bottom:6px}\n  #auth .auth-metrics-kicker,#auth .auth-metrics-note{font-size:10px}\n  #auth .auth-metrics-heading{font-size:18px}\n  #auth .auth-metric{padding:9px;gap:4px}\n  #auth .auth-metric-icon{width:30px;height:30px}\n  #auth .auth-metric-num{font-size:26px}\n  #auth .auth-metric-caption{font-size:10.5px}\n}\n@media (min-width:761px) and (max-width:900px) and (max-height:790px){\n  #auth .auth-wrap{grid-template-columns:minmax(0,1fr) minmax(0,1fr);width:min(100%,960px);gap:20px}\n  #auth .auth-hero h1{font-size:clamp(24px,3.1vw,30px)}\n  #auth .auth-hero .lede{font-size:13px;line-height:1.4}\n  #auth .auth-card{padding:14px}\n  #auth .install-panel{margin-top:10px}\n  #auth .auth-metrics-wrap{margin-top:8px}\n  #auth .auth-metric{padding:9px}\n}\n/* On phones, show a practical one-screen summary, not a miniature desktop page. */\n@media (max-width:600px){\n  #auth{justify-content:flex-start;padding:8px max(10px,env(safe-area-inset-right,0px)) max(9px,env(safe-area-inset-bottom,0px)) max(10px,env(safe-area-inset-left,0px))}\n  #auth .auth-wrap{width:min(100%,520px);display:grid;grid-template-columns:minmax(0,1fr);gap:7px}\n  #auth .auth-hero{display:flex;flex-direction:column;align-items:flex-start;gap:2px}\n  #auth .auth-hero .brand{gap:7px}\n  #auth .auth-hero .brand .owl{width:32px;height:32px}\n  #auth .auth-hero .brand b{font-size:14px}\n  #auth .auth-hero .brand-en,#auth .auth-hero .eyebrow,\n  #auth .auth-hero .lede,#auth .auth-hero .points,\n  #auth .auth-hero .paper{display:none}\n  #auth .auth-hero h1{font-size:clamp(16px,4.7vw,20px);line-height:1.17;margin:0}\n  #auth .auth-card{padding:9px 11px;border-radius:12px}\n  #auth .tabs{padding:2px;margin-bottom:6px}\n  #auth .tabs button{min-height:40px;font-size:14px}\n  #auth .auth-for{font-size:11px;line-height:1.3;margin:0 0 7px}\n  #auth .form{gap:7px}\n  #auth .fld{gap:3px}\n  #auth .fld>span{font-size:12px}\n  #auth .fld input:not([type=checkbox]):not([type=radio]){min-height:44px;padding:8px 10px;font-size:16px}\n  #auth .form>.btn{min-height:44px}\n  #auth .chk{font-size:12px}\n  #auth .switch{font-size:12px}\n  #auth .row-between{gap:5px}\n  #auth .store-note{font-size:10.5px;line-height:1.35;margin-top:7px;padding-top:7px}\n  #auth .install-panel{width:min(100%,520px);margin-top:7px;padding:7px 9px;border-radius:11px}\n  #auth .install-panel-top{display:grid;grid-template-columns:minmax(0,1fr);gap:5px}\n  #auth .install-panel-head{gap:5px}\n  #auth .install-panel-head p,#auth .install-panel-icon{display:none}\n  #auth .install-panel h2{font-size:12px;line-height:1.2}\n  #auth .install-platforms{grid-template-columns:repeat(4,minmax(0,1fr));gap:4px}\n  #auth .install-platform{display:flex;align-items:center;justify-content:center;min-height:44px;padding:4px 2px;gap:0;border-radius:7px}\n  #auth .install-platform>span,#auth .install-platform small{display:none}\n  #auth .install-platform strong{font-size:11px;line-height:1.15;text-align:center;overflow-wrap:anywhere}\n  #auth .auth-metrics-wrap{width:min(100%,520px);margin-top:7px;margin-bottom:0}\n  #auth .auth-metrics-top{margin-bottom:4px}\n  #auth .auth-metrics-kicker,#auth .auth-metrics-note{display:none}\n  #auth .auth-metrics-heading{font-size:13px;line-height:1.15;margin:0}\n  #auth .auth-metrics{grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}\n  #auth .auth-metric{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:6px;border-radius:9px}\n  #auth .auth-metric-top,#auth .auth-metric-caption{display:none}\n  #auth .auth-metric-num{font-size:21px;line-height:1.1}\n  #auth .auth-metric-label{font-size:10px;line-height:1.2}\n}\n@media (max-width:360px) and (max-height:700px){\n  #auth .auth-hero h1{font-size:16px}\n  #auth .auth-card{padding:7px 9px}\n  #auth .form{gap:6px}\n  #auth .auth-metrics-heading{font-size:12px}\n}\n";

  function init() {
    const landing = doc.getElementById('auth');
    if (!landing || doc.getElementById('landing-viewport-fit-style')) return;
    const style = doc.createElement('style');
    style.id = 'landing-viewport-fit-style';
    style.textContent = STYLE_TEXT;
    doc.head.appendChild(style);

    let pending = false;
    function fit() {
      pending = false;
      landing.style.removeProperty('zoom');
      landing.style.removeProperty('width');
      const html = doc.documentElement;
      if (!landing.isConnected || html.classList.contains('student-entry') ||
          root.getComputedStyle(landing).display === 'none') {
        html.dataset.landingFit = 'inactive';
        return;
      }
      const viewport = root.visualViewport;
      const height = viewport && Math.abs(viewport.scale - 1) < .02 ?
        viewport.height : root.innerHeight;
      if (!height || height < 420) {
        html.dataset.landingFit = 'scroll';
        return;
      }
      const bar = doc.body.classList.contains('has-sbar') ?
        parseFloat(root.getComputedStyle(doc.body).getPropertyValue('--sbh')) || 0 : 0;
      const available = height - bar;
      const formRegister = doc.getElementById('f-reg');
      const installSteps = doc.getElementById('install-steps');
      const forgotBox = doc.getElementById('forgot-box');
      const expanded = (formRegister && !formRegister.hidden) ||
        (installSteps && !installSteps.hidden) || (forgotBox && !forgotBox.hidden);
      const active = doc.activeElement;
      const keyboard = active && landing.contains(active) &&
        /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName) &&
        viewport && viewport.height < root.innerHeight * .78;
      if (expanded || keyboard) {
        html.dataset.landingFit = 'scroll';
        return;
      }
      const naturalHeight = Math.ceil(landing.getBoundingClientRect().height);
      const factor = Math.min(1, (available - 2) / Math.max(1,naturalHeight));
      const width = html.clientWidth || root.innerWidth;
      const minFactor = width <= 480 ? .89 : width <= 900 ? .83 : .77;
      if (factor >= minFactor && factor < .995 && root.CSS &&
          root.CSS.supports && root.CSS.supports('zoom','0.9')) {
        landing.style.zoom = factor.toFixed(3);
        landing.style.width = (100 / factor).toFixed(3) + '%';
        html.dataset.landingFit = 'scaled';
      } else {
        html.dataset.landingFit = factor < minFactor ? 'scroll' : 'native';
      }
    }

    function schedule() {
      if (pending) return;
      pending = true;
      if (root.requestAnimationFrame) root.requestAnimationFrame(fit);
      else root.setTimeout(fit, 16);
    }
    schedule();
    root.addEventListener('resize', schedule, {passive:true});
    root.addEventListener('orientationchange', schedule, {passive:true});
    root.visualViewport?.addEventListener('resize', schedule, {passive:true});
    doc.fonts?.ready?.then(schedule).catch(function () {});
    const watch = new MutationObserver(schedule);
    watch.observe(landing, {subtree:true,attributes:true,attributeFilter:['hidden']});
    landing.addEventListener('click', function () { root.setTimeout(schedule, 0); });
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})(typeof window !== 'undefined' ? window : globalThis);
