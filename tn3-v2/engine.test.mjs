import test from 'node:test';
import assert from 'node:assert/strict';
import core from './engine.js';
import models from './model.js';

test('Every DH has normalized priors and categorical probabilities',()=>{
  for(const dh of ['DH01','DH02','DH03','DH04']) {
    assert.equal(core.check(models[dh]),true);
    assert.equal(models[dh].calibrationStatus,'GIẢ ĐỊNH, CHƯA ĐO TỪ HỌC SINH');
  }
});
test('A response cannot be recorded without source text',()=>{
  const state=core.begin(models.DH04);
  assert.throws(()=>core.answer(state,'r1',''),/nguyên văn/);
  assert.equal(state.history.length,0);
});
test('Posterior is normalized after every answered question',()=>{
  const state=core.begin(models.DH04);
  const before=core.status(state);
  assert.equal(before.kind,'ask');
  core.answer(state,'r1','Bài làm minh họa: em thấy chữ b là hệ số.');
  assert.ok(Math.abs(state.posterior.reduce((a,b)=>a+b,0)-1)<1e-10);
});
test('No more than two questions, without duplicate question ID',()=>{
  const state=core.begin(models.DH04);
  for(let i=0;i<2;i++) {
    const d=core.status(state);
    if(d.kind!=='ask')break;
    core.answer(state,'U','Bài mô phỏng không thể phân biệt được.');
  }
  assert.ok(state.history.length<=2);
  assert.equal(new Set(state.history.map(x=>x.q)).size,state.history.length);
  assert.notEqual(core.status(state).kind,'ask');
});
test('Inconclusive remains a valid status',()=>{
  const state=core.begin(models.DH04);
  core.answer(state,'U','Không có giải thích.');
  if(core.status(state).kind==='ask')core.answer(state,'U','Vẫn không rõ.');
  assert.equal(core.status(state).kind,'inconclusive');
});
test('Invalid response probability matrices are rejected',()=>{
  const model=JSON.parse(JSON.stringify(models.DH04));
  model.questions[0].rates[0]=[.8,.8,.8,.8];
  assert.throws(()=>core.check(model),/tổng 1/);
});
