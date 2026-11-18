import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const source = html.slice(html.indexOf('function boardToolbarHtml('), html.indexOf('function renderBoard('));
const state = {view: {pq: ''}, psort: 'new'};
const render = vm.runInNewContext(source + '\nboardToolbarHtml', {
  S: state, ic: () => '', layoutKey: x => x,
  SORTS: [['new', 'Mới nhất'], ['old', 'Cũ nhất']],
  LAYOUTS: [['tuong', 'Tường'], ['cot', 'Cột']],
  esc: value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
});
const board = {id: 'board-1', layout: 'cot'};
const teacher = {gv: true, manage: true, dir: 'v', review: 7};
const actions = markup => new Set([...markup.matchAll(/data-act="([^"]+)"/g)].map(m => m[1]));

test('class managers retain submission, review, display, reports and group actions', () => {
  const result = render(board, teacher);
  assert.deepEqual([...actions(result)].sort(), ['add-col','add-row','bdir','bg-pick','capture','class-report','progress','progress-tracker','publish-class','review'].sort());
  assert.match(result, /aria-label="Chờ duyệt, 7 bài"/);
  assert.match(result, /data-v="v" aria-pressed="true"/);
  assert.match(result, /<option value="cot" selected>/);
});

test('learner and shared teacher toolbars preserve the existing permission boundary', () => {
  const learner = render(board, {gv: false, manage: false, dir: 'h', review: 0});
  assert.deepEqual([...actions(learner)], ['bdir']);
  assert.match(learner, /id="b-sort"/);
  assert.doesNotMatch(learner, /id="b-layout"|Theo dõi học tập|Chờ duyệt/);
  const shared = render(board, {...teacher, manage: false});
  assert.deepEqual([...actions(shared)].sort(), ['bdir','progress','review'].sort());
  assert.equal(actions(render({...board, trashed: true}, teacher)).has('progress-tracker'), false);
});

test('secondary tools collapse initially on phones and retain an explicit expanded choice', () => {
  assert.match(render(board, teacher), /class="board-toolbar-options" open>/);
  assert.match(render(board, {...teacher, compact: true}), /class="board-toolbar-options">/);
  assert.match(render(board, {...teacher, compact: true, expanded: true}), /class="board-toolbar-options" open>/);
});

test('search text is escaped and a zero pending count has no misleading badge', () => {
  state.view.pq = '"><img src=x onerror=alert(1)>';
  const result = render(board, {...teacher, review: 0});
  assert.match(result, /value="&quot;&gt;&lt;img/);
  assert.doesNotMatch(result, /<img|has-pending|class="bcnt"/);
  state.view.pq = '';
});
