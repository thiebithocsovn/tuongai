(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TN3V2 = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const THRESHOLD = 0.80;
  const LIMIT = 2;
  const EPS = 1e-10;
  const OUTCOMES = ['r1','r2','r3','U'];
  function check(config) {
    if (!config || !Array.isArray(config.prior) || config.prior.length !== 3
        || !Array.isArray(config.questions) || config.questions.length !== 3) {
      throw new Error('Mỗi dấu hiệu phải có ba nguyên nhân, ba câu hỏi.');
    }
    const valid = x => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1;
    if (config.prior.some(x => !valid(x)) || Math.abs(config.prior.reduce((a,b)=>a+b,0)-1)>1e-8) {
      throw new Error('Xác suất ban đầu phải thuộc [0,1] và có tổng 1.');
    }
    for (const q of config.questions) {
      if (!q.text || !Array.isArray(q.rates) || q.rates.length !== 3
        || q.rates.some(row => !Array.isArray(row) || row.length !== 4
          || row.some(x=>!valid(x)) || Math.abs(row.reduce((a,b)=>a+b,0)-1)>1e-8)) {
        throw new Error('P(r1,r2,r3,U | c) phải là ba hàng hợp lệ có tổng 1 cho mỗi câu.');
      }
    }
    return true;
  }
  function entropy(p) {return -p.reduce((s,v)=>s+(v>0?v*Math.log2(v):0),0);}
  function update(p, rates, outcome) {
    const o=OUTCOMES.indexOf(outcome);
    if (o<0) throw new Error('Phản hồi phải là r1,r2,r3 hoặc U.');
    const weights=p.map((v,i)=>v*rates[i][o]);
    const z=weights.reduce((a,b)=>a+b,0);
    if (z <= EPS) throw new Error('Phản hồi có xác suất bằng 0 trong mô hình; cần kiểm tra lại, không suy đoán.');
    return weights.map(w=>w/z);
  }
  function gain(p,rates) {
    let rem=0;
    for (let o=0;o<4;o++) {
      const mass=p.reduce((s,v,i)=>s+v*rates[i][o],0);
      if (mass>EPS) rem+=mass*entropy(update(p,rates,OUTCOMES[o]));
    }
    return Math.max(0,entropy(p)-rem);
  }
  function begin(config) {
    check(config);
    return {config,posterior:config.prior.slice(),history:[],createdAt:new Date().toISOString()};
  }
  function status(state) {
    const p=state.posterior;
    const top=Math.max(...p);
    const cause='c'+(p.indexOf(top)+1);
    if (top>=THRESHOLD-EPS) return {kind:'qualified',cause,confidence:top};
    if (state.history.length>=LIMIT) return {kind:'inconclusive',reason:'Đã hỏi hai câu nhưng chưa đủ ngưỡng 0,80.',confidence:top};
    const used=new Set(state.history.map(x=>x.q));
    const ranked=state.config.questions.map((q,i)=>({idx:i,q:'q'+(i+1),ig:gain(p,q.rates)}))
      .filter(x=>!used.has(x.q)).sort((a,b)=>b.ig-a.ig||a.idx-b.idx);
    if (!ranked.length || ranked[0].ig < EPS) return {kind:'inconclusive',reason:'Không còn câu hỏi phân biệt theo tham số.',confidence:top};
    return {kind:'ask',question:ranked[0].q,idx:ranked[0].idx,text:state.config.questions[ranked[0].idx].text,ig:ranked[0].ig,ranked};
  }
  function answer(state, outcome, rawText) {
    const before=status(state);
    if (before.kind!=='ask') throw new Error('Không có câu hỏi cần trả lời.');
    if (!String(rawText||'').trim()) throw new Error('Phải ghi lại câu trả lời nguyên văn trước khi mã hóa.');
    const old=state.posterior.slice();
    const next=update(old,state.config.questions[before.idx].rates,outcome);
    state.history.push({q:before.question,question:before.text,rawText:String(rawText),outcome,
      posteriorBefore:old,posteriorAfter:next,informationGain:before.ig});
    state.posterior=next;
    return status(state);
  }
  return {THRESHOLD,LIMIT,OUTCOMES,check,entropy,update,gain,begin,status,answer};
});
