import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const section = (start, end) => html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start)));
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const board = {id:'board', ownerAcc:'teacher', columns:[{id:'c-test', name:'Bài giáo viên'}, {id:'c-p1', name:'THỰC HIỆN PHIẾU 1 - P1'}]};
const original = {
  id:'post', boardId:'board', columnId:'c-test', ownerAcc:'teacher', studentName:'Học sinh thử',
  by:'hs', text:'Bài làm', images:[{k:'s', path:'private/work.jpg'}], attachments:[{path:'private/work.docx', name:'Bài.docx'}],
  studentToken:'synthetic-private-token', createdAt:123, ai:{diem:7}, teacher:{score:8, approvedAt:456, note:'Đã duyệt'},
  similarQuestions:['Bài luyện tập'], practice:[{id:'practice'}], practiceSubmissions:[{id:'answer'}],
};

function fixture(options = {}) {
  const S = {posts:new Map([['post', structuredClone(original)]]), guest:options.guest || null};
  const database = new Map([['post', structuredClone(original)]]);
  const calls = [];
  let renders = 0;
  const sb = {from(table) {
    const call = {table, filters:[]}; calls.push(call);
    const query = {
      update(patch) {call.patch = patch; return query;},
      eq(key, value) {call.filters.push([key, value]); return query;},
      select(fields) {call.select = fields; return query;},
      async single() {
        if (options.response) return options.response;
        if (options.beforeSave) await options.beforeSave(S, database);
        const row = database.get('post');
        const raw = {id:row.id, board_id:row.boardId, column_id:row.columnId};
        if (!call.filters.every(([key, value]) => raw[key] === value)) return {data:null, error:{code:'PGRST116'}};
        database.set('post', {...row, columnId:call.patch.column_id});
        return {data:{id:'post', column_id:call.patch.column_id}, error:null};
      },
    };
    return query;
  }};
  const context = {
    S, CAP:{sb}, getPost:id => S.posts.get(id), getBoard:() => options.board || board,
    canManage:() => options.manage !== false, renderSoon:() => {renders++;},
  };
  const move = vm.runInNewContext(section('async function movePostToColumn(', 'async function removePost(') + '\nmovePostToColumn', context);
  return {S, database, calls, context, move, renders:() => renders};
}

test('Move changes only the column of the existing submission and preserves all student data', async () => {
  for (const destination of ['c-p1', '']) {
    const f = fixture();
    assert.equal(await f.move('post', destination), true);
    assert.deepEqual({...f.S.posts.get('post'), columnId:original.columnId}, original);
    assert.deepEqual({...f.database.get('post'), columnId:original.columnId}, original);
    assert.equal(f.S.posts.get('post').columnId, destination);
    assert.equal(f.database.size, 1);
    assert.deepEqual(Object.keys(f.calls[0].patch), ['column_id']);
    assert.deepEqual(Array.from(f.calls[0].filters, pair => Array.from(pair)), [['id','post'], ['board_id','board'], ['column_id','c-test']]);
    assert.equal(f.renders(), 1);
  }
});

test('Students, guests and teachers who do not manage the board cannot move submissions', async () => {
  for (const options of [{manage:false}, {guest:{role:'hs'}}]) {
    const f = fixture(options);
    await assert.rejects(f.move('post','c-p1'), /Chỉ giáo viên quản lý lớp/);
    assert.equal(f.calls.length, 0);
    assert.equal(f.S.posts.get('post').columnId, 'c-test');
  }
});

test('Missing submissions, removed destinations and unchanged positions never issue a write', async () => {
  const f = fixture();
  await assert.rejects(f.move('missing','c-p1'));
  await assert.rejects(f.move('post','removed-column'), /không còn tồn tại/);
  await assert.rejects(f.move('post',null), /không còn tồn tại/);
  await assert.rejects(f.move('post','c-test'), /đã ở vị trí này/);
  assert.equal(f.calls.length, 0);
});

test('Network failure, RLS zero rows and an unconfirmed response keep the original location', async () => {
  for (const response of [{data:null, error:{message:'Mất kết nối'}}, {data:null, error:{code:'PGRST116'}}, {data:null, error:null}]) {
    const f = fixture({response});
    await assert.rejects(f.move('post','c-p1'));
    assert.deepEqual(f.S.posts.get('post'), original);
    assert.equal(f.renders(), 0);
  }
});

test('An in-flight move preserves newer feedback that arrives during the request', async () => {
  const f = fixture({beforeSave:async S => {
    const p = S.posts.get('post');
    S.posts.set('post', {...p, teacher:{...p.teacher, note:'Nhận xét mới hơn', score:9}});
  }});
  await f.move('post','c-p1');
  assert.equal(f.S.posts.get('post').teacher.note, 'Nhận xét mới hơn');
  assert.equal(f.S.posts.get('post').teacher.score, 9);
  assert.equal(f.S.posts.get('post').columnId, 'c-p1');
});

test('A concurrent move by another teacher is not overwritten', async () => {
  const f = fixture({beforeSave:async (S, database) => {
    database.set('post', {...database.get('post'), columnId:''});
    S.posts.set('post', {...S.posts.get('post'), columnId:''});
  }});
  await assert.rejects(f.move('post','c-p1'), /Bài đã thay đổi/);
  assert.equal(f.database.get('post').columnId, '');
  assert.equal(f.S.posts.get('post').columnId, '');
});

function formFixture({failure = false, vertical = false} = {}) {
  const f = fixture();
  let markup, closed = false;
  const messages = [];
  const nodes = new Map(['#post-move-form','#post-move-column','#post-move-save','#post-move-error'].map(id => [id, {
    value:id === '#post-move-column' ? 'c-test' : '', disabled:id === '#post-move-save', textContent:'',
    events:{}, addEventListener(type, fn) {this.events[type] = fn;},
  }]));
  const context = {...f.context, esc, boardDir:() => vertical ? 'v' : 'h',
    openModal:options => {markup = options; return {el:{}, close:() => {closed = true;}};},
    $:selector => nodes.get(selector), toast:message => messages.push(message),
    movePostToColumn:async (id, column) => {if (failure) throw new Error('Mất kết nối'); return f.move(id, column);},
  };
  const open = vm.runInNewContext(section('function movePostForm(', '/* ---------- xem ảnh:') + '\nmovePostForm',context);
  open(original);
  return {...f, nodes, markup, messages, closed:() => closed};
}

test('The form identifies the source, supports columns/rows and only enables a different destination', () => {
  for (const vertical of [false, true]) {
    const f = formFixture({vertical});
    assert.match(f.markup.body, /Đang ở: <strong>Bài giáo viên/);
    assert.ok(f.markup.body.includes(vertical ? 'Hàng nhận bài' : 'Cột nhận bài'));
    assert.match(f.markup.body, /value="c-test" selected disabled/);
    assert.equal(f.nodes.get('#post-move-save').disabled, true);
    f.nodes.get('#post-move-column').value = 'c-p1';
    f.nodes.get('#post-move-column').events.change();
    assert.equal(f.nodes.get('#post-move-save').disabled, false);
  }
});

test('The form announces success only after saving and keeps a failed move open for retry', async () => {
  for (const failure of [false, true]) {
    const f = formFixture({failure});
    f.nodes.get('#post-move-column').value = 'c-p1';
    f.nodes.get('#post-move-column').events.change();
    await f.nodes.get('#post-move-form').events.submit({preventDefault(){}});
    assert.equal(f.closed(), !failure);
    assert.equal(f.messages.length, failure ? 0 : 1);
    assert.equal(f.nodes.get('#post-move-column').disabled, false);
    assert.equal(f.nodes.get('#post-move-error').textContent, failure ? 'Mất kết nối' : '');
    assert.equal(f.S.posts.get('post').columnId, failure ? 'c-test' : 'c-p1');
  }
});

test('Only the managing teacher sees the direct move button on a student card', () => {
  for (const teacher of [true, false]) for (const manage of [true, false]) for (const announcement of [true, false]) {
    const context = {
      S:{meId:'teacher', grading:new Set()}, getBoard:() => board, finalScore:() => 8,
      isTeacherAnnouncement:() => announcement, isGV:() => teacher, canManage:() => manage,
      tmeta:p => p.teacher, aiOn:() => false, splitLinks:() => ({text:'Bài làm', links:[]}),
      postColor:() => '#ffffff', peerPost:() => false, studentCanEdit:() => false,
      studentFeedbackInlineHtml:() => '', linkChips:() => '', imgSrc:() => '', esc, ic:() => '', fmt:String,
    };
    const card = vm.runInNewContext(section('function postCard(', '/* ---------- menu của một bài:') + '\npostCard', context);
    const output = card(original, false);
    assert.equal(output.includes('data-act="p-move"'), teacher && manage && !announcement);
  }
});
