const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../m56.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

function fixture(overrides = {}) {
  const window = {};
  vm.runInNewContext(source, { window });
  const elements = new Map();
  const root = { querySelector(selector) {
    if (!elements.has(selector)) elements.set(selector, { innerHTML: '', textContent: '' });
    return elements.get(selector);
  }};
  const calls = { messages: [], modals: [], closes: 0 };
  const host = {
    isGV: () => true, isGuest: () => false,
    getBoard: () => ({ id: 'board' }), canManage: () => true,
    isTeacherAnnouncement: () => false,
    toast: message => calls.messages.push(message),
    openModal: options => {
      calls.modals.push(options);
      return { el: root, close: () => { calls.closes += 1; } };
    }, ...overrides
  };
  const post = { id: 'post', boardId: 'board', studentName: 'TN01', ai: { loi_sai: [{ loi: 'Lỗi 1' }, { loi: 'Lỗi 2' }] } };
  return { api: window.TuongAiM56, host, calls, elements, post, window };
}

test('opens from a separate script with closure-owned host functions', () => {
  const f = fixture();
  f.api.open(f.post, 0, f.host);
  assert.equal(f.calls.modals.length, 1);
  assert.match(f.calls.modals[0].title, /TN01/);
  assert.match(f.elements.get('[data-m56-output]').innerHTML, /Nhập đủ bảng MC02/);
});

test('both application entry points use the host adapter', () => {
  assert.equal((html.match(/openM56\(p\)/g) || []).length, 3);
  assert.doesNotMatch(html, /TuongAiM56\?\.open\(p\)/);
  const start = html.indexOf('function openM56(p) {');
  const end = html.indexOf('async function detailAct', start);
  const f = fixture();
  const context = { window: f.window, ...f.host, S: { guest: null } };
  vm.runInNewContext(html.slice(start, end) + '\nopenM56(' + JSON.stringify(f.post) + ');', context);
  assert.equal(f.calls.modals.length, 1);
});

test('changing the error keeps the same authorized host', () => {
  const f = fixture();
  f.api.open(f.post, 0, f.host);
  f.elements.get('[data-m56-error]').onchange({ target: { value: '1' } });
  assert.equal(f.calls.closes, 1);
  assert.equal(f.calls.modals.length, 2);
  assert.match(f.calls.modals[1].body, /Lỗi 2/);
});

for (const [name, overrides, message] of [
  ['student', { isGV: () => false }, /Chỉ giáo viên/],
  ['guest', { isGuest: () => true }, /Chỉ giáo viên/],
  ['unmanaged board', { canManage: () => false }, /không có quyền/],
  ['missing board', { getBoard: () => null }, /không có quyền/],
  ['teacher announcement', { isTeacherAnnouncement: () => true }, /không có quyền/]
]) test('denies ' + name + ' without opening a modal', () => {
  const f = fixture(overrides);
  f.api.open(f.post, 0, f.host);
  assert.equal(f.calls.modals.length, 0);
  assert.match(f.calls.messages[0], message);
});

test('reports missing AI errors through the host toast', () => {
  const f = fixture();
  f.post.ai.loi_sai = [];
  f.api.open(f.post, 0, f.host);
  assert.equal(f.calls.modals.length, 0);
  assert.match(f.calls.messages[0], /Chưa có lỗi AI/);
});
