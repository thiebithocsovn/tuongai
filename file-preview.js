/* Tường học tập AI – xem tệp ngay tại bài đăng.
 * Tệp được đọc tại trình duyệt bằng URL có chữ ký ngắn hạn từ kho riêng tư.
 * Không gửi tài liệu lên dịch vụ xem trước bên thứ ba. */
(function () {
  'use strict';
  const active = new WeakMap();
  const scripts = new Map();
  const mod = new Map();
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const extOf = (a) => String(a?.name || '').toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || '';
  function loadScript(src) {
    if (!scripts.has(src)) scripts.set(src, new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => {scripts.delete(src); s.remove(); reject(new Error('Không tải được bộ đọc tài liệu. Vui lòng kiểm tra mạng.'));};
      document.head.appendChild(s);
    }));
    return scripts.get(src);
  }
  function loadModule(src) {
    if (!mod.has(src)) mod.set(src, import(src).catch(err => {mod.delete(src); throw err;}));
    return mod.get(src);
  }
  function close(el) {
    const s = active.get(el);
    if (!s) return;
    s.controller.abort();
    for (const fn of s.cleanups) try {fn();} catch (_) {}
    active.delete(el);
  }
  function dispose(root) {
    if (!root) return;
    if (root.matches?.('[data-file-preview]')) close(root);
    root.querySelectorAll?.('[data-file-preview]').forEach(close);
  }
  const limit = 25 * 1024 * 1024;
  async function render(el, attachment, url) {
    close(el);
    const state = {controller:new AbortController(),cleanups:[]};
    active.set(el,state);
    const live = () => active.get(el) === state && el.isConnected && !state.controller.signal.aborted;
    el.hidden = false;
    el.innerHTML = '<div class="fp-loading" role="status">Đang đọc tài liệu trong Tường học tập AI…</div>';
    const extension = extOf(attachment);
    if (['doc','ppt'].includes(extension)) {
      el.innerHTML = '<p class="fp-note">Đây là định dạng Office đời cũ (' + esc(extension.toUpperCase()) + '). Để xem đầy đủ ngay trên website, thầy cô hãy lưu lại dưới dạng ' + (extension === 'doc' ? 'DOCX' : 'PPTX') + ' rồi tải lên. Tệp gốc vẫn có thể tải về ở phía trên.</p>';
      return;
    }
    try {
      if (!url || !/^https:\/\//i.test(url)) throw new Error('Liên kết tệp chưa sẵn sàng. Hãy mở lại bài.');
      const res = await fetch(url, {signal:state.controller.signal,cache:'no-store'});
      if (!res.ok) throw new Error('Không đọc được tệp (' + res.status + '). Liên kết có thể đã hết hạn.');
      const declared = Number(res.headers.get('content-length') || 0);
      if (declared > limit) throw new Error('Tệp quá lớn để xem trực tiếp (giới hạn 25 MB).');
      const data = await res.arrayBuffer();
      if (!live()) return;
      if (data.byteLength > limit) throw new Error('Tệp quá lớn để xem trực tiếp.');
      if (['jpg','jpeg','png','gif','webp','bmp'].includes(extension)) {
        const mime = {jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',gif:'image/gif',webp:'image/webp',bmp:'image/bmp'}[extension];
        const objectUrl = URL.createObjectURL(new Blob([data],{type:mime}));
        state.cleanups.push(()=>URL.revokeObjectURL(objectUrl));
        el.innerHTML = '<div class="fp-image-wrap"><img src="' + esc(objectUrl) + '" alt="' + esc(attachment.name) + '" loading="lazy"></div>';
      } else if (extension === 'pdf') {
        const pdfjs = await loadModule('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');
        if (!live()) return;
        pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
        const pdf = await pdfjs.getDocument({data:new Uint8Array(data),isEvalSupported:false}).promise;
        state.cleanups.push(()=>{pdf.destroy().catch(()=>{});});
        if (!live()) return;
        el.innerHTML='<div class="fp-toolbar"><button type="button" data-prev aria-label="Trang trước">‹</button><strong data-count></strong><button type="button" data-next aria-label="Trang sau">›</button></div><canvas class="fp-canvas" aria-label="Trang PDF"></canvas>';
        let index=1,busy=false;
        const prev=el.querySelector('[data-prev]'),next=el.querySelector('[data-next]'),count=el.querySelector('[data-count]'),canvas=el.querySelector('canvas');
        const paint=async()=>{
          if (busy || !live()) return;busy=true;prev.disabled=next.disabled=true;
          try {
            const page=await pdf.getPage(index);if(!live())return;
            const origin=page.getViewport({scale:1}),width=Math.min(1100,Math.max(320,el.clientWidth-26));
            const viewport=page.getViewport({scale:width/origin.width});
            canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
            await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
            if(live())count.textContent='Trang '+index+' / '+pdf.numPages;
          } finally {busy=false;if(live()){prev.disabled=index<=1;next.disabled=index>=pdf.numPages;}}
        };
        prev.onclick=()=>{if(!busy&&index>1){index--;paint().catch(showError);}};
        next.onclick=()=>{if(!busy&&index<pdf.numPages){index++;paint().catch(showError);}};
        await paint();
      } else if (extension === 'docx') {
        await loadScript('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');
        await loadScript('https://cdn.jsdelivr.net/npm/docx-preview@0.3.6/dist/docx-preview.min.js');
        if(!live())return;
        el.innerHTML='<div class="fp-docx" role="document"></div>';
        const target=el.querySelector('.fp-docx');
        if (!window.docx?.renderAsync) throw new Error('Trình xem Word chưa khởi tạo.');
        await window.docx.renderAsync(data,target,undefined,{breakPages:true,ignoreFonts:false,inWrapper:true});
        if(!live())return;
        // Không cho tệp Word gắn mã hoặc đường dẫn nguy hiểm vào giao diện ứng dụng.
        target.querySelectorAll('script,iframe,object,embed,form').forEach(n=>n.remove());
        target.querySelectorAll('*').forEach(n=>{
          for (const attr of [...n.attributes]) {
            if (/^on/i.test(attr.name)) n.removeAttribute(attr.name);
            else if (['href','src','xlink:href','formaction'].includes(attr.name.toLowerCase()) && /^(?:\s*javascript:|\s*data:text\/html)/i.test(attr.value)) n.removeAttribute(attr.name);
          }
          if(n.tagName==='A'){n.target='_blank';n.rel='noopener noreferrer';}
        });
      } else if (['xls','xlsx','ods'].includes(extension)) {
        await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
        if(!live())return;
        const wb=window.XLSX.read(data,{type:'array',cellHTML:false,cellFormula:false});
        if(!wb.SheetNames.length){el.textContent='Tệp Excel không có trang tính.';return;}
        el.innerHTML='<div class="fp-toolbar"><label for="fp-sheet-select">Trang tính</label><select id="fp-sheet-select" aria-label="Chọn trang tính"></select></div><div class="fp-sheet"></div>';
        const select=el.querySelector('select'),body=el.querySelector('.fp-sheet');
        wb.SheetNames.forEach((name,i)=>{const opt=document.createElement('option');opt.value=String(i);opt.textContent=name;select.appendChild(opt);});
        const show=()=>{const ws=wb.Sheets[wb.SheetNames[Number(select.value)]],cells=window.XLSX.utils.sheet_to_json(ws,{header:1,defval:'',blankrows:false,raw:false}).slice(0,400);body.innerHTML='<table><tbody>'+cells.map(row=>'<tr>'+row.slice(0,40).map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table>'+(cells.length===400?'<p class="fp-note">Đang hiển thị tối đa 400 hàng đầu tiên của trang tính.</p>':'');};
        select.onchange=show;show();
      } else if (extension === 'pptx') {
        const module=await loadModule('https://cdn.jsdelivr.net/npm/pptx-browser@4.1.5/+esm');
        if(!live())return;
        const PptxRenderer=module.PptxRenderer || module.default?.PptxRenderer;
        if(typeof PptxRenderer!=='function')throw new Error('Chưa tải được trình hiển thị PowerPoint.');
        const renderer=new PptxRenderer();
        state.cleanups.push(()=>renderer.destroy());
        await renderer.load(data);
        if(!live())return;
        const total=renderer.slideCount;
        if(!total){el.textContent='Không tìm thấy trang trình chiếu.';return;}
        el.innerHTML='<div class="fp-toolbar"><button type="button" data-prev aria-label="Slide trước">‹</button><strong data-count></strong><button type="button" data-next aria-label="Slide sau">›</button></div><canvas class="fp-canvas" aria-label="Nội dung slide PowerPoint"></canvas>';
        let slide=0,busy=false;
        const prev=el.querySelector('[data-prev]'),next=el.querySelector('[data-next]'),count=el.querySelector('[data-count]'),canvas=el.querySelector('canvas');
        const paint=async()=>{
          if(busy||!live())return;busy=true;prev.disabled=next.disabled=true;
          try{await renderer.renderSlide(slide,canvas,Math.min(1100,Math.max(360,el.clientWidth-24)));if(live())count.textContent='Slide '+(slide+1)+' / '+total;}
          finally{busy=false;if(live()){prev.disabled=slide===0;next.disabled=slide===total-1;}}
        };
        prev.onclick=()=>{if(!busy&&slide>0){slide--;paint().catch(showError);}};
        next.onclick=()=>{if(!busy&&slide<total-1){slide++;paint().catch(showError);}};
        await paint();
      } else if (['txt','csv'].includes(extension)) {
        const str=new TextDecoder('utf-8').decode(data);
        el.innerHTML='<pre class="fp-plain"></pre>';
        el.querySelector('pre').textContent=str.slice(0,500000);
      } else {
        throw new Error('Định dạng '+extension.toUpperCase()+' chưa hỗ trợ xem trực tiếp. Có thể tải tệp gốc ở phía trên.');
      }
    } catch(err) {
      if(err?.name==='AbortError'||!live())return;
      showError(err);
    }
    function showError(error) {
      if(live())el.innerHTML='<div class="fp-error" role="alert">'+esc(error?.message||'Không thể mở xem trước tệp này.')+'</div>';
    }
  }
  window.TuongAiFilePreview={render,dispose,close,extOf};
})();