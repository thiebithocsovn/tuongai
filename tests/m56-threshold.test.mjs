import test from 'node:test';
import assert from 'node:assert/strict';
import m56 from '../m56.js';

// MC02-TH (02/11/2026): design estimates; NOT student responses.
function config(dh, prior, rates) {
  return m56.validate({
    causes: prior.map((p, i) => ({label: dh + '-c' + (i + 1), prior: p})),
    questions: rates.map((r, i) => ({text: dh + '-q' + (i + 1), likelihoods: r})),
  });
}

test('DH04 cannot attain the 0.80 decision threshold with two questions', () => {
  const c=config('DH04',[.43,.35,.22],[[.22,.43,.89],[.27,.37,.89],[.63,.22,.89]]);
  assert.ok(Math.abs(m56.maxReachableConfidence(c)-.7635673761428107)<1e-11);
  assert.ok(m56.maxReachableConfidence(c)<c.threshold);
});

test('DH02 permits qualifying answer paths without changing MC02 probabilities', () => {
  const c=config('DH02',[.38,.36,.26],[[.22,.78,.91],[.73,.22,.91],[.67,.71,.94]]);
  assert.ok(m56.maxReachableConfidence(c)>.80);
  assert.equal(c.maxQuestions,2);
  assert.equal(c.threshold,.80);
});

test('MC02 data entry is not falsely labeled as independently confirmed', () => {
  const c=config('DH04',[.43,.35,.22],[[.22,.43,.89],[.27,.37,.89],[.63,.22,.89]]);
  assert.match(c.source,/cần đối chiếu phiếu gốc/);
});

test('M6 remains inconclusive after two insufficient answers', () => {
  const c=config('DH04',[.43,.35,.22],[[.22,.43,.89],[.27,.37,.89],[.63,.22,.89]]);
  const state={config:c,posterior:c.causes.map(x=>x.prior),history:[]};
  for(let n=0;n<2;n++) {
    assert.equal(m56.decision(state).status,'ask');
    m56.answer(state,n===0);
  }
  assert.equal(m56.decision(state).status,'inconclusive');
});
