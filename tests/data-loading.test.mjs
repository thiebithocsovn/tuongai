import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const begin = html.indexOf('async function fetchAllRows(');
const end = html.indexOf('function subscribeCloud()', begin);
assert.ok(begin >= 0 && end > begin, 'load helpers exist in the application');
const code = html.slice(begin, end);
const rows = (n, table) => Array.from({length:n}, (_, i) => ({
  id:table + '-' + String(i).padStart(5, '0'),
  created_at:'2026-11-01T00:00:00Z', updated_at:'2026-11-01T00:00:00Z',
}));
function fixture(sizes, failAt) {
  const calls = [];
  const tables = Object.fromEntries(Object.entries(sizes).map(([name, size]) => [name, rows(size, name)]));
  const old = new Map([['retained', {id:'retained'}]]);
  const S = {boards:old, posts:old, members:old};
  const sb = {from(table) {
    const orders = [];
    return {
      select(columns) {this.columns = columns; return this;},
      order(column, options) {orders.push([column, options.ascending]); return this;},
      async range(from, to) {
        calls.push({table, from, to, orders:[...orders], columns:this.columns});
        if (failAt?.table === table && from === failAt.from) {
          return {data:null, error:{message:'network interrupted', code:'test_failure'}};
        }
        const sorted = [...tables[table]].sort((a, b) => {
          for (const [field, asc] of orders) {
            const diff = String(a[field]).localeCompare(String(b[field]));
            if (diff) return asc ? diff : -diff;
          }
          return 0;
        });
        // Simulate the production API's 1,000-row response cap.
        return {data:sorted.slice(from, Math.min(to + 1, from + 1000)), error:null};
      },
    };
  }};
  const load = vm.runInNewContext(code + '\nloadData', {CAP:{sb}, S, rowToBoard:r=>r, rowToPost:r=>r});
  return {load, S, old, calls};
}
test('loads all 1,151 posts rather than the first API response', async () => {
  const f = fixture({boards:46, posts:1151, profiles:24});
  await f.load();
  assert.equal(f.S.posts.size, 1151);
  assert.ok(f.S.posts.has('posts-00000'));
  assert.ok(f.S.posts.has('posts-01150'));
  assert.equal(f.S.boards.size, 46);
  assert.equal(f.S.members.size, 24);
  assert.deepEqual(f.calls.filter(c=>c.table==='posts').map(c=>[c.from,c.to]), [[0,499],[500,999],[1000,1499]]);
});
test('paginates boards and member records as well', async () => {
  const f = fixture({boards:1001, posts:1, profiles:1001});
  await f.load();
  assert.equal(f.S.boards.size, 1001);
  assert.equal(f.S.members.size, 1001);
});
test('uses a stable id tie-breaker when timestamps are equal', async () => {
  const f = fixture({boards:2, posts:1001, profiles:2});
  await f.load();
  assert.equal(f.S.posts.size, 1001);
  for (const call of f.calls.filter(c=>c.table==='posts')) {
    assert.deepEqual(Array.from(call.orders, o=>Array.from(o)), [['created_at', false], ['id', false]]);
  }
});
test('an exact multiple of a page and an empty result terminate', async () => {
  const f = fixture({boards:0, posts:1000, profiles:0});
  await f.load();
  assert.equal(f.S.posts.size, 1000);
  assert.equal(f.S.boards.size, 0);
  assert.equal(f.calls.filter(c=>c.table==='posts').length, 3);
});
test('a later-page error preserves every previously displayed collection', async () => {
  const f = fixture({boards:46, posts:1151, profiles:24}, {table:'posts', from:500});
  await assert.rejects(f.load(), error=>error.code==='test_failure');
  assert.strictEqual(f.S.boards, f.old);
  assert.strictEqual(f.S.posts, f.old);
  assert.strictEqual(f.S.members, f.old);
});
