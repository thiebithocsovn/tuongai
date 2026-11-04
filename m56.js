(function m56Module(){
  'use strict';
  const memory = new Map();
  const LIMIT = 2, THRESHOLD = 0.80, EPS = 1e-10;
  function finite01(n){
    return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;
  }
  function validate(config){
    if(!config || !Array.isArray(config.causes) || config.causes.length !== 3 || !Array.isArray(config.questions) || config.questions.length !== 3) throw new Error('Cần đúng 3 nguyên nhân c1–c3 và 3 câu hỏi q1–q3 theo MC02-1.');
    const causes = config.causes.map((c,i)=>({id:'c'+(i+1), label:String(c.label||'').trim(), prior:Number(c.prior)}));
    if(causes.some(c=>!c.label || !finite01(c.prior)))throw new Error('Điền tên nguyên nhân và P(c) từ 0 đến 1.');
    const sum = causes.reduce((s,c)=>s+c.prior,0);
    if(Math.abs(sum-1)>0.011)throw new Error('Tổng P(c1)+P(c2)+P(c3) phải bằng 1 (sai số làm tròn tối đa 0,01).');
    if(sum <= EPS)throw new Error('Tổng xác suất không hợp lệ.');
    const questions = config.questions.map((q,i)=>{
      const rates=Array.isArray(q.likelihoods)?q.likelihoods.map(Number):[];
      if(!String(q.text||'').trim() || rates.length!==3 || rates.some(x=>!finite01(x)))throw new Error('Điền đủ câu hỏi q'+(i+1)+' và P(đúng | c1–c3) từ 0 đến 1.');
      return {id:'q'+(i+1),text:String(q.text).trim(),likelihoods:rates};
    });
    return {causes:causes.map(c=>({...c,prior:c.prior/sum})),questions,source:'MC02-1 (giáo viên xác nhận)',maxQuestions:LIMIT,threshold:THRESHOLD};
  }
  function entropy(p){return p.reduce((s,x)=>x>0?s-x*Math.log2(x):s,0);}
  function outcome(p,rates,yes){
    const w=p.map((v,i)=>v*(yes?rates[i]:1-rates[i]));
    const mass=w.reduce((a,b)=>a+b,0);
    return {mass,posterior:mass>EPS?w.map(x=>x/mass):null};
  }
  function gain(p,q){
    const y=outcome(p,q.likelihoods,true),n=outcome(p,q.likelihoods,false);
    const remain=(y.mass>EPS?y.mass*entropy(y.posterior):0)+(n.mass>EPS?n.mass*entropy(n.posterior):0);
    return Math.max(0,entropy(p)-remain);
  }
  function decision(state){
    const p=state.posterior, sorted=p.map((v,i)=>({v,i})).sort((a,b)=>b.v-a.v);
    if(sorted[0].v >= THRESHOLD-EPS)return {status:'qualified',cause:state.config.causes[sorted[0].i],confidence:sorted[0].v};
    if(state.history.length>=LIMIT)return {status:'inconclusive',reason:'Đã hỏi đủ 2 câu mà chưa đạt 0,80.'};
    const used=new Set(state.history.map(h=>h.questionId));
    const ranked=state.config.questions.filter(q=>!used.has(q.id)).map(q=>({question:q,ig:gain(p,q)})).sort((a,b)=>b.ig-a.ig || a.question.id.localeCompare(b.question.id));
    if(!ranked.length || ranked[0].ig<EPS)return {status:'inconclusive',reason:'Không có câu hỏi còn lại đủ lượng thông tin để phân biệt nguyên nhân.',ranked};
    return {status:'ask',...ranked[0],ranked};
  }
  function answer(state,correct){
    const d=decision(state);
    if(d.status!=='ask')throw new Error('Không có câu hỏi đang chờ trả lời.');
    const update=outcome(state.posterior,d.question.likelihoods,Boolean(correct));
    if(!update.posterior)throw new Error('Câu trả lời có xác suất bằng 0 theo bảng MC02; cần kiểm tra lại số liệu, không tự thay đổi kết quả.');
    const historyEntry={questionId:d.question.id,question:d.question.text,igBefore:d.ig,response:correct?'Đúng':'Sai',prior:[...state.posterior],posterior:[...update.posterior]};
    state.history.push(historyEntry);state.posterior=update.posterior;
    return decision(state);
  }
  const txt=v=>String(v==null?'':v).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  const val=(r,sel)=>r.querySelector(sel)?.value;
  const asNumber=s=>String(s??'').trim()===''?NaN:Number(String(s).replace(',','.'));
  const fmt=n=>Number(n).toFixed(3);
  const percent=n=>(100*n).toFixed(1)+'%';
  function open(p,selectedError=0){
    if(typeof isGV!=='function'||!isGV()||S.guest) return toast('Chỉ giáo viên được sử dụng M5–M6.');
    const b=getBoard(p.boardId);
    if(!b || !canManage(b) || isTeacherAnnouncement(p))return toast('Bạn không có quyền phân tích bài này.');
    const errors=Array.isArray(p.ai?.loi_sai)?p.ai.loi_sai.filter(x=>x&&typeof x==='object'):[];
    if(!errors.length)return toast('Chưa có lỗi AI để kiểm chứng. Hãy phân tích bài làm trước.');
    const idx=Math.max(0,Math.min(errors.length-1,Number(selectedError)||0));
    const key=p.id+':'+idx;
    const issue=errors[idx],session=memory.get(key);
    const config=session?.config;
    const input=(extra,value='')=>`<input class="inp" ${extra} value="${txt(value)}" autocomplete="off">`;
    const causeRow=(i)=>`<tr><td>c${i+1}</td><td>${input('data-m56-cause="'+i+'" maxlength="160" placeholder="Nguyên nhân theo MC02"',config?.causes[i]?.label)}</td><td>${input('data-m56-prior="'+i+'" inputmode="decimal" type="number" min="0" max="1" step="0.01" style="width:95px"',config?.causes[i]?.prior??'')}</td></tr>`;
    const questionRow=(i)=>{
      const q=config?.questions[i];
      return `<tr><td>q${i+1}<div style="min-width:170px">${input('data-m56-question="'+i+'" maxlength="250" placeholder="Câu hỏi kiểm chứng"',q?.text)}</div></td>`+[0,1,2].map(k=>`<td>${input('data-m56-rate="'+i+'-'+k+'" inputmode="decimal" type="number" min="0" max="1" step="0.01" style="width:80px"',q?.likelihoods[k]??'')}</td>`).join('')+'</tr>';
    };
    const body=`<div class="modal-b" style="max-height:70vh;overflow:auto">
      <p class="meta"><strong>M5:</strong> Chọn q có IG kỳ vọng cao nhất · <strong>M6:</strong> Bayes, dừng khi max P(c) ≥ 0,80 hoặc đã hỏi 2 câu.</p>
      <p class="as-warn">Chế độ hỗ trợ giáo viên, chưa phải kết quả TN3. Không có số liệu giả định hoặc tự gán nhãn. Câu trả lời do giáo viên nhập và phải đối chiếu phiếu MC05-5.</p>
      <label class="fld"><span>Chọn lỗi cần truy gốc</span><select class="inp" data-m56-error>${errors.map((e,i)=>`<option value="${i}" ${i===idx?'selected':''}>Lỗi ${i+1} – ${txt(String(e.cau||e.vi_tri||e.loi||'').slice(0,110))}</option>`).join('')}</select></label>
      <p class="meta"><strong>AI gợi ý:</strong> ${txt(String(issue.nguyen_nhan||issue.loi||'Chưa có gợi ý').slice(0,450))} (chưa xác minh)</p>
      <p><strong>Bước 1. Nhập bảng MC02-1</strong> (giáo viên xác nhận, không sử dụng số minh họa).</p>
      <div class="as-tbl" style="overflow-x:auto"><table><thead><tr><th>Mã</th><th>Nguyên nhân</th><th>P(c)</th></tr></thead><tbody>${[0,1,2].map(causeRow).join('')}</tbody></table></div>
      <p style="margin-top:12px"><strong>Bước 2. Câu hỏi và P(trả lời đúng | nguyên nhân)</strong></p>
      <div class="as-tbl" style="overflow-x:auto"><table><thead><tr><th>Câu hỏi</th><th>c1</th><th>c2</th><th>c3</th></tr></thead><tbody>${[0,1,2].map(questionRow).join('')}</tbody></table></div>
      <div class="row-gap" style="margin:12px 0"><button type="button" class="btn btn-brand" data-m56-calc>Tính M5 / bắt đầu M6</button><button type="button" class="btn btn-sm" data-m56-export>Tải nhật ký tính toán JSON</button></div>
      <p class="form-err" data-m56-error-text role="alert"></p>
      <div data-m56-output aria-live="polite"></div>
      <p class="meta">Chưa đồng bộ với cơ sở dữ liệu hoặc công bố cho học sinh. Khi sửa bảng và bấm Tính lại, các câu trả lời thử trên phiên làm việc này được đặt lại.</p></div>`;
    const m=openModal({title:'M5–M6 · Truy gốc lỗi – '+(p.studentName||'Bài nộp'),wide:true,body});
    const root=m.el;
    root.querySelector('[data-m56-error]').onchange=e=>{const k=Number(e.target.value);m.close();open(p,k);};
    function readConfig(){
      const causes=[0,1,2].map(i=>({label:val(root,`[data-m56-cause="${i}"]`),prior:asNumber(val(root,`[data-m56-prior="${i}"]`))}));
      const questions=[0,1,2].map(i=>({text:val(root,`[data-m56-question="${i}"]`),likelihoods:[0,1,2].map(j=>asNumber(val(root,`[data-m56-rate="${i}-${j}"]`)))}));
      return validate({causes,questions});
    }
    function render(){
      const el=root.querySelector('[data-m56-output]'),st=memory.get(key);
      if(!st){el.innerHTML='<p class="meta">Nhập đủ bảng MC02-1, sau đó bấm Tính M5 để bắt đầu.</p>';return;}
      const d=decision(st);
      const rows=st.config.causes.map((c,i)=>`<tr><td>${txt(c.id)} – ${txt(c.label)}</td><td>${percent(st.posterior[i])}</td></tr>`).join('');
      const history=st.history.map((h,i)=>`<li>q${h.questionId.slice(1)}: ${txt(h.question)} → <strong>${txt(h.response)}</strong>; IG = ${fmt(h.igBefore)} bit</li>`).join('');
      const status=d.status==='qualified'?`<p class="as-ok"><strong>Đã đạt ngưỡng 0,80:</strong> ${txt(d.cause.label)} (${percent(d.confidence)}). Giáo viên phải xác minh trước khi chốt nguyên nhân.</p>`:
        d.status==='inconclusive'?`<p class="as-warn"><strong>Chưa đủ căn cứ.</strong> ${txt(d.reason)}</p>`:
        `<p class="as-ok"><strong>M5 chọn ${txt(d.question.id)}:</strong> ${txt(d.question.text)} (IG = ${fmt(d.ig)} bit)</p><div class="row-gap"><button type="button" class="btn btn-sm btn-brand" data-m56-answer="1">Trả lời: Đúng</button><button type="button" class="btn btn-sm" data-m56-answer="0">Trả lời: Sai</button></div>`;
      el.innerHTML=`<div class="as-tbl"><table><thead><tr><th>Giả thuyết</th><th>Bayes P(c)</th></tr></thead><tbody>${rows}</tbody></table></div>
        <p class="meta">Entropy hiện tại: ${fmt(entropy(st.posterior))} bit · Đã hỏi ${st.history.length}/${LIMIT} câu.</p>
        ${st.history.length?`<p><strong>Nhật ký câu trả lời (giáo viên nhập):</strong></p><ol>${history}</ol>`:''}${status}
        ${d.status==='ask'?`<p class="meta">Xếp hạng IG: ${d.ranked.map(x=>`${txt(x.question.id)}=${fmt(x.ig)}`).join(' · ')}</p>`:''}`;
      el.querySelectorAll('[data-m56-answer]').forEach(btn=>btn.onclick=()=>{
        const error=root.querySelector('[data-m56-error-text]');error.textContent='';
        try{answer(st,btn.dataset.m56Answer==='1');render();}
        catch(e){error.textContent=e.message;}
      });
    }
    root.querySelector('[data-m56-calc]').onclick=()=>{
      const error=root.querySelector('[data-m56-error-text]');error.textContent='';
      try{
        const cfg=readConfig();
        memory.set(key,{config:cfg,posterior:cfg.causes.map(c=>c.prior),history:[],postId:p.id,errorIndex:idx,createdAt:new Date().toISOString()});
        render();
      }catch(e){error.textContent=e.message;}
    };
    root.querySelector('[data-m56-export]').onclick=()=>{
      const s=memory.get(key);
      if(!s)return(root.querySelector('[data-m56-error-text]').textContent='Cần bấm Tính M5 trước khi xuất minh chứng.');
      const state=decision(s);
      const output={schema:'tuongai-m56-v1',type:'teacher_assisted_calculation_not_TN3',createdAt:s.createdAt,exportedAt:new Date().toISOString(),
        postId:s.postId,errorIndex:s.errorIndex,config:s.config,history:s.history,posterior:s.posterior,decision:{status:state.status,causeId:state.cause?.id||null,confidence:state.confidence??null,reason:state.reason||null},note:'Chỉ dùng minh họa cách tính. Đối chiếu MC02/MC05 và xác minh ngày, người thực hiện; chưa phải số liệu TN3.'};
      const blob=new Blob([JSON.stringify(output,null,2)],{type:'application/json;charset=utf-8'});
      const url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download='MC03_M5M6_'+String(p.id).slice(0,12)+'_loi'+(idx+1)+'.json';
      document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
    };
    render();
  }
  const api={validate,entropy,gain,outcome,decision,answer,open};
  if(typeof window!=='undefined')window.TuongAiM56=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();
