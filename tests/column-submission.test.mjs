import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const section = (start, end) => html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start)));
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const board = {
  id:'class-1', code:'ABC123', name:'Lớp thử', layout:'cot', autoGrade:false,
  columns:[{id:'first', name:'Bài 1'}, {id:'second', name:'Bài 2 "Thực hành"'}],
};

test('Both submission entry points remain above the posts and target their own column in either direction', () => {
  for (const teacher of [false, true]) for (const direction of ['h', 'v']) {
    const render = vm.runInNewContext(section('function renderPosts(', 'function imgSrc(') + '\nrenderPosts', {
      layoutKey:(v) => v, boardDir:() => direction, canManage:() => teacher,
      studentColumnOrders:new Map(), esc, ic:() => '<svg></svg>', postCard:() => '<article>Bài đã nộp</article>',
    });
    // Include an empty column and a populated column; neither may lose its entry points.
    const output = render(board, [{id:'existing', columnId:'first'}], teacher, '');
    assert.ok(output.includes('cols dir-' + direction));
    const columns = [...output.matchAll(/<section class="col"[\s\S]*?<\/section>/g)];
    assert.equal(columns.length, 2);
    columns.forEach(([column], index) => {
      const buttons = [...column.matchAll(/<button\b[^>]*>/g)]
        .map(([tag]) => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]])))
        .filter((attrs) => /\b(col-submit-btn|col-addpost)\b/.test(attrs.class));
      assert.equal(buttons.length, 2);
      for (const button of buttons) {
        assert.equal(button.type, 'button');
        assert.equal(button['data-act'], teacher ? 'publish-class' : 'submit');
        assert.equal(button['data-id'], board.id);
        assert.equal(button['data-col'], board.columns[index].id);
        assert.equal(button['aria-label'], esc((teacher ? 'Đăng bài' : 'Nộp bài') + ' vào ' + board.columns[index].name));
      }
      assert.ok(column.indexOf('col-submit-btn') < column.indexOf('col-addpost'));
      assert.ok(column.indexOf('col-addpost') < column.indexOf('col-post-viewport'));
      assert.equal(column.includes('data-act="col-del"'), teacher);
    });
  }
});

async function submitTo(columnId, {demo = false, teacher = false, publish = false} = {}) {
  const b = {...board, demo};
  const nodes = new Map();
  const node = (selector, value = '') => nodes.set(selector, {value, addEventListener() {}, focus() {}});
  for (const selector of ['#sf', '#sf-shots', '#sf-err', '#sf-save', '#sf-link', '#sf-ai']) node(selector);
  if (!publish) node('#sf-name', 'Học sinh thử');
  node('#sf-student-name', 'Học sinh thử');
  node('#sf-student-class', '8A'); node('#sf-text', 'Nội dung bài làm thử');
  if (teacher) node('#sf-col', b.columns[0].id);
  let saved;
  let closed = false;
  const S = {auth:{accounts:[]}, posts:new Map(), meId:'hs-test', guest:null};
  const submit = vm.runInNewContext(section('function submitForm(', '/* Editing and deleting student submissions') + '\nsubmitForm', {
    ME:() => ({id:'hs-test', name:'Giáo viên thử', role:teacher ? 'gv' : 'hs'}), ownerLabel:() => 'Giáo viên thử', S,
    postsOf:() => [], esc, ic:() => '', aiOn:() => false, attachPickerHtml:() => '',
    openModal:() => ({el:{querySelector:() => ({})}, close:() => {closed = true;}}),
    initAttachPicker:() => ({files:[]}), $:(selector) => nodes.get(selector) || null, $$:() => [],
    checkAttachments() {}, uuid:() => 'new-post', guestId:() => 'hs-test', deviceToken:() => 'test-device',
    uploadAttachments:async () => [],
    api:async (action, payload) => {assert.equal(action, 'student_submit'); saved = payload; return {post:{id:'new-post'}};},
    rememberUrls() {}, rowToPost:(p) => p, enterGuest() {}, toast() {}, studentReloadMine() {}, openDetail() {},
    now:() => 123, savePost:async (p) => {saved = p; return true;},
  });
  submit(b, teacher, columnId, publish);
  await nodes.get('#sf-save').onclick();
  assert.equal(nodes.get('#sf-err').textContent, '');
  assert.equal(closed, true);
  return saved;
}

test('Submitting from the second column or Bài chung preserves that destination for students and teachers', async () => {
  for (const columnId of ['second', '']) {
    const studentPost = await submitTo(columnId);
    assert.equal(studentPost.column_id, columnId);
    assert.equal(studentPost.text, 'Nội dung bài làm thử');
    const demoPost = await submitTo(columnId, {demo:true});
    assert.equal(demoPost.columnId, columnId);
    const teacherPost = await submitTo(columnId, {demo:true, teacher:true});
    assert.equal(teacherPost.columnId, columnId);
    assert.equal(teacherPost.teacher.postType, 'student_work');
    const teacherAssignment = await submitTo(columnId, {demo:true, teacher:true, publish:true});
    assert.equal(teacherAssignment.columnId, columnId);
    assert.equal(teacherAssignment.studentName, 'Giáo viên thử');
    assert.equal(teacherAssignment.teacher.postType, 'announcement');
  }
});
