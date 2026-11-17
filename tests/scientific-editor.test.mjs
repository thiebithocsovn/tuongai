import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const katex = require('../vendor/katex/katex.min.js');
vm.runInNewContext(fs.readFileSync(new URL('../vendor/katex/contrib/mhchem.min.js',import.meta.url),'utf8'),{katex});
const window = {katex};
vm.runInNewContext(fs.readFileSync(new URL('../scientific-text.js',import.meta.url),'utf8'),{window});
const html = fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const esc = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const start = html.indexOf('function asFormulaField('), end = html.indexOf('/* Chỉ tài khoản giáo viên đăng nhập',start);
assert.ok(start>=0 && end>start);
const context = {
  esc,science:window.ScientificText.html,ic:()=>'',getPost:()=>({boardId:'board'}),getBoard:()=>({}),aiOn:()=>true,
  AS_LEVEL:{foundation:'Củng cố'},
};
const render = vm.runInNewContext(html.slice(start,end)+'\nasSimilarHtml',context);
function state(status='draft') {
  return {id:'sample',open:{},similar:{status,mode:'topic',count:3,difficulty:'foundation',instructions:'Phân tích đa thức thành nhân tử.',
    exercises:[{question:'Phân tích x^2 - 5x + 6 thành nhân tử.',hint:'Dùng $x_1+x_2=5$.',expectedAnswer:'$x^2-5x+6=(x-2)(x-3)$',successCriteria:'Nêu đúng các bước.'}]}};
}

test('teacher sees a typeset polynomial first and can expand the editable source without changing its value',()=>{
  const result=render(state());
  assert.match(result,/<msup><mi>x<\/mi><mn>2<\/mn><\/msup>/);
  assert.match(result,/<details class="formula-edit"[^>]*>\s*<summary>Chỉnh sửa đề bài<\/summary>/);
  assert.match(result,/data-asf="simex.0.question"[^>]*>Phân tích x\^2 - 5x \+ 6 thành nhân tử\.<\/textarea>/);
  assert.ok(result.indexOf('aria-label="Đề bài đã định dạng"') < result.indexOf('data-asf="simex.0.question"'));
});

test('assigned exercises remain typeset and read only, and answer previews stay inside teacher-only details',()=>{
  const result=render(state('assigned'));
  assert.match(result,/<msup>/);
  assert.doesNotMatch(result.slice(result.indexOf('<div class="as-similar-result">')),/<textarea/);
  const details=result.indexOf('<details class="as-sub"');
  const answer=result.indexOf('aria-label="Đáp án / hướng giải đã định dạng"');
  const close=result.indexOf('</details>',details);
  assert.ok(details>=0 && details<answer && answer<close);
});

test('opening an editor survives the application rerender and untrusted source remains escaped',()=>{
  const input=state();
  input.open['formula-simex.0.question']=true;
  input.similar.exercises[0].question='<img src=x onerror=alert(1)> x^2';
  const result=render(input);
  assert.match(result,/data-asd="formula-simex.0.question" open/);
  assert.match(result,/&lt;img/);
  assert.doesNotMatch(result,/<img src=x/);
});

test('legacy powers and LaTeX preserve complete exponents, Greek symbols and fraction structure',()=>{
  for(const source of ['A^12','x_1^2','(x+1)^(n+1)','\\alpha^2','\\frac{x^{2}+1}{2}','\\sqrt[3]{x+1}','\\ce{Fe^{3+}}']) {
    assert.match(window.ScientificText.html(source),/class="katex/);
  }
  assert.match(window.ScientificText.html('x^12'),/<mn>12<\/mn>/);
  assert.match(window.ScientificText.html('\\frac{x^{2}+1}{2}'),/<mfrac>/);
  assert.match(window.ScientificText.html('`x^2` và https://example.org/$x^2$'),/`x\^2` và https:\/\/example.org\/\$x\^2\$/);
  assert.match(window.ScientificText.html('$\\unknown{x}$'),/\$\\unknown\{x\}\$/);
});
