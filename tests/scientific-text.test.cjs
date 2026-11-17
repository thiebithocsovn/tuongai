const {test}=require('node:test');
const assert=require('node:assert/strict');
global.katex=require('../vendor/katex/katex.min.js');
require('node:vm').runInNewContext(require('node:fs').readFileSync(require('node:path').join(__dirname,'../vendor/katex/contrib/mhchem.min.js'),'utf8'),{katex:global.katex});
const {html}=require('../scientific-text.js');
test('renders powers, grouped exponents and subscripts',()=>{
 for(const s of ['x^2','a^{n+1}','(x+1)^2','x_1','$x^{12}$','\\(x^2\\)']) assert.match(html(s),/class="katex"/);
});
test('renders fractions, roots, block math and chemical equations',()=>{
 for(const s of ['H2O','CO2','Na2SO4','Fe(OH)3','$\\frac{1}{2}$','$\\sqrt{x}$','$$x^2+y^2$$','$\\ce{H2SO4}$','$\\ce{Fe^{3+} + 3OH- -> Fe(OH)3}$']) {
  assert.match(html(s),/class="katex/); assert.doesNotMatch(html(s),/katex-error/);
 }
});
test('escapes HTML and retains URLs, literal text and invalid TeX',()=>{
 assert.match(html('<img src=x onerror=alert(1)>'),/&lt;img/);
 assert.doesNotMatch(html('$\\href{javascript:alert(1)}{click}$'),/href="javascript:/);
 assert.match(html('https://example.org/x_1?q=x^2'),/https:\/\/example.org\/x_1\?q=x\^2/);
 assert.match(html('$\\unknown{a}$'),/\\unknown/);
 assert.match(html('Bài TN3 và mã DH04'),/Bài TN3 và mã DH04/);
});
