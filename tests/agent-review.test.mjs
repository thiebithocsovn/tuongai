import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import * as agent from '../supabase/functions/tuongai/agent-review.ts';
import * as autoGrade from '../supabase/functions/tuongai/auto-grade-retry.ts';
import * as visibility from '../supabase/functions/tuongai/student-visibility.ts';
import * as references from '../supabase/functions/tuongai/answer-reference.ts';
import * as schoolManager from '../supabase/functions/tuongai/school-manager.ts';

const server = fs.readFileSync(new URL('../supabase/functions/tuongai/index.ts', import.meta.url), 'utf8');
const agentSource = fs.readFileSync(new URL('../supabase/functions/tuongai/agent-review.ts', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const asJson = (value) => JSON.parse(JSON.stringify(value));
const analysis = {
  summary: 'Kiểm tra bình phương của một tổng', feedback: 'Em hãy khai triển theo phép nhân.',
  errors: [
    { id: 'e1', title: 'Thiếu tích đôi', skill: 'Hằng đẳng thức', evidence: '(a+b)² = a²+b²', hypothesis: 'Nhầm quy tắc' },
    { id: 'e2', title: 'Sai dấu', skill: 'Quy tắc dấu', evidence: 'Dòng 2', hypothesis: 'Chưa rõ' },
  ],
};
const exercise = { errorId: 'e1', question: 'Khai triển (x+4)²', hint: 'Viết thành tích hai nhị thức', expectedAnswer: 'x²+8x+16', successCriteria: 'Có tích đôi' };
const token = 'student-device-token-0001';
const board = { id: 'board-1', owner: 'teacher-1', code: 'AGTEST', shared: true, trashed: false, auto_grade: true, assignment: { maxScore: 10 }, columns: [] };

function setup({ v2 = false, serverAI = false } = {}) {
  const activeBoard = structuredClone(board);
  activeBoard.assignment.agentReviewV2 = v2;
  const posts = [];
  const profiles = ['teacher-1', 'teacher-2'].map((id) => ({ id, full_name: id, role: 'teacher', status: 'active' }));
  const due = [], tasks = [], prompts = [];
  const cronToken = 'worker-test-token-'.repeat(3);
  const rows = { posts, profiles, boards: [activeBoard], app_config: [], practice_submissions: [], school_manager_boards: [], school_manager_schools: [] };
  if (serverAI) rows.app_config.push({ key: 'gemini_key', value: 'fixture-key' }, { key: 'agent_review_cron_token', value: cronToken });
  let handler;
  const db = {
    auth: { getUser: async (id) => ({ data: { user: profiles.find((p) => p.id === id) } }) },
    from(table) {
      const filters = [];
      let input;
      const result = () => {
        if (input) { rows[table].push({ ...input, created_at: new Date().toISOString() }); return structuredClone(rows[table].at(-1)); }
        return structuredClone(rows[table].filter((r) => filters.every((f) => f(r))));
      };
      return {
        select() { return this; }, order() { return this; }, range() { return this; }, limit() { return this; },
        eq(key, value) { filters.push((r) => r[key] === value); return this; },
        not(key) { assert.equal(key, 'teacher->>approvedAt'); filters.push((r) => !!r.teacher?.approvedAt); return this; },
        in(key, values) { filters.push((r) => values.includes(r[key])); return this; }, insert(row) { input = row; return this; },
        async single() { const data = result(); return { data: input ? data : data[0] }; },
        async maybeSingle() { return { data: result()[0] || null }; },
        then(resolve) { resolve({ data: result() }); },
      };
    },
    async rpc(name, args) {
      if (name === 'agent_review_v2_due_posts') return { data: due.map(post_id => ({ post_id })) };
      assert.ok(['update_post_teacher_if_unchanged', 'update_agent_review_v2_if_unchanged'].includes(name));
      if (name === 'update_agent_review_v2_if_unchanged' && !agent.v2EligibleBoard(activeBoard)) return { data: false };
      const p = posts.find((row) => row.id === args.p_id && row.owner === args.p_owner && row.board_id === args.p_board);
      if (!p || JSON.stringify(p.teacher ?? null) !== JSON.stringify(args.p_expected_teacher) ||
          JSON.stringify([p.body, p.images, p.attachments]) !== JSON.stringify(args.p_expected_work)) return { data: false };
      p.teacher = asJson(args.p_teacher);
      return { data: true };
    },
  };
  const compiled = stripTypeScriptTypes(server.replace(/^import [\s\S]*?;\n/gm, ''), { mode: 'transform' });
  vm.runInNewContext(compiled, {
    ...agent, ...autoGrade, ...references, ...visibility, ...schoolManager, publicPost: visibility.studentPost, crypto, Request, Response, TextEncoder,
    createClient: () => db, Deno: { env: { get: () => '' }, serve: (fn) => { handler = fn; } },
    ...(serverAI ? {
      EdgeRuntime: { waitUntil: (task) => tasks.push(task) },
      fetch: async (url, init) => {
        assert.match(url, /^https:\/\/generativelanguage\.googleapis\.com\//);
        prompts.push(JSON.parse(init.body).contents[0].parts.at(-1).text);
        const result = { ...analysis, suggestedScore: 0, scoreReason: 'Thiếu tích đôi trong câu duy nhất.' };
        return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(result) }] } }] });
      },
    } : {}),
  });
  const call = async (action, input, user, headers = {}) => {
    const response = await handler(new Request('https://example.test/functions/v1/tuongai', {
      method: 'POST', headers: user ? { ...headers, authorization: 'Bearer ' + user } : headers,
      body: JSON.stringify({ action, ...input }),
    }));
    return { status: response.status, body: await response.json() };
  };
  const submit = () => call('student_submit', { code: board.code, name: 'Học sinh thử', token, text: '(a+b)² = a²+b²' });
  const review = (id, operation, input = {}, user = board.owner) => call('agent_review', { post_id: id, operation, ...input }, user);
  const tick = () => call('agent_review_tick', {}, '', { 'x-agent-review-tick': cronToken });
  return { submit, review, call, tick, posts, activeBoard, due, tasks, prompts };
}

test('AgentReview runs from student submission to private analysis, teacher approval and assigned practice', async () => {
  const { submit, review, call, posts } = setup();
  const sent = await submit();
  assert.equal(sent.status, 200, JSON.stringify(sent.body));
  const id = sent.body.post.id;
  assert.equal(sent.body.post.teacher.assist, undefined);
  assert.deepEqual(posts[0].teacher.assist.agentReview, { kind: 'analysis', status: 'pending' });
  assert.equal((await review(id, 'claim', {}, '')).status, 401);
  assert.equal((await review(id, 'claim', {}, 'teacher-2')).status, 403);
  const [left, right] = await Promise.all([review(id, 'claim'), review(id, 'claim')]);
  const jobs = [left, right].map((x) => x.body.job).filter(Boolean);
  assert.equal(jobs.length, 1);
  const draftResult = await review(id, 'complete', { lease: jobs[0].lease, result: analysis, model: 'test-model' });
  assert.equal(draftResult.status, 200);
  const draft = draftResult.body.teacher.assist.a;
  assert.equal(draft.review.status, 'draft');
  assert.equal(draft.analysis.errors[0].decision, 'pending');
  const ownFeed = () => call('student_feed', { code: board.code, token });
  assert.deepEqual((await ownFeed()).body.posts[0].practice, []);
  assert.equal((await ownFeed()).body.posts[0].teacher.assist, undefined);
  assert.equal((await review(id, 'claim')).body.job, null);

  const approval = { draft_id: draft.id, score: 7, feedback: 'Em luyện lại hằng đẳng thức.' };
  const decisions = [
    { id: 'e1', decision: 'confirmed', teacherCause: 'Nhầm bình phương của một tổng', verificationEvidence: 'Em giải thích rằng bình phương từng hạng tử.' },
    { id: 'e2', decision: 'insufficient' },
  ];
  assert.equal((await review(id, 'approve', { ...approval, decisions: [{ ...decisions[0], verificationEvidence: '' }, decisions[1]] })).status, 400);
  const approved = await review(id, 'approve', { ...approval, decisions });
  assert.equal(approved.status, 200);
  assert.equal(approved.body.teacher.by, board.owner);
  assert.equal((await review(id, 'approve', { ...approval, decisions })).status, 409);
  const practice = (await review(id, 'claim')).body.job;
  assert.equal(practice.kind, 'practice');
  const invalid = await review(id, 'complete', { lease: practice.lease, result: { exercises: [{ ...exercise, errorId: 'e2' }] } });
  assert.equal(invalid.status, 502);
  const generated = await review(id, 'complete', { lease: practice.lease, result: { exercises: [exercise, { ...exercise, errorId: 'e2' }] } });
  assert.equal(generated.status, 200);
  const pack = generated.body.teacher.assist.a.practice;
  assert.equal(pack.status, 'draft');
  assert.deepEqual(pack.exercises.map((e) => e.errorId), ['e1']);
  assert.deepEqual((await ownFeed()).body.posts[0].practice, []);
  posts[0].teacher.assist.a.practice.status = 'assigned';
  const pupil = (await ownFeed()).body.posts[0];
  assert.equal(pupil.teacher.score, 7);
  assert.equal(pupil.practice[0].exercises[0].question, exercise.question);
  assert.equal(pupil.practice[0].exercises[0].expectedAnswer, undefined);
  assert.equal(pupil.teacher.assist, undefined);
  const peer = (await call('student_feed', { code: board.code, token: 'other-student-token-0002' })).body.posts[0];
  assert.equal(peer.teacher.score, undefined);
  assert.deepEqual(peer.practice, []);
});

test('V2 queues attachment-only submissions without approving a grade', () => {
  const p = {
    by: 'hs', body: '', images: [], attachments: [{ name: 'bai-lam.docx', path: 'private/file.docx' }],
    teacher: { assist: { agentReview: agent.pendingReviewJob('analysis') } },
  };
  assert.equal(agent.claimableReviewJob(p, board, false), 'analysis');
  assert.equal(p.teacher.approvedAt, undefined);
});
test('V2 automatically drafts a score, causes and feedback, then publishes the teacher decision privately', async () => {
  const { submit, review, call, posts, tasks, prompts } = setup({ v2: true, serverAI: true });
  const sent = await submit();
  assert.equal(sent.status, 200);
  const id = sent.body.post.id;
  assert.equal(sent.body.post.teacher.score, undefined);
  assert.equal(sent.body.post.teacher.note, undefined);
  await Promise.all(tasks.splice(0));
  const draft = posts[0].teacher.assist.a;
  assert.equal(draft.analysis.suggestedScore, 0);
  assert.equal(draft.analysis.scoreReason, 'Thiếu tích đôi trong câu duy nhất.');
  assert.equal(draft.review.score, null);
  assert.equal(draft.review.feedback, analysis.feedback);
  assert.equal(draft.analysis.errors[0].hypothesis, analysis.errors[0].hypothesis);
  assert.equal(draft.analysis.errors[0].teacherCause, '');
  assert.match(prompts[0], /suggestedScore từ 0 đến 10 điểm/);
  const overview = await call('agent_review_queue', { operation: 'overview' }, board.owner);
  assert.equal(overview.body.items[0].suggestedScore, 0);
  assert.equal(overview.body.items[0].pendingErrors, 2);
  const ownResult = () => call('student_mine', { code: board.code, token });
  const before = (await ownResult()).body.posts[0];
  assert.equal(before.teacher.score, undefined);
  assert.equal(before.teacher.note, undefined);
  assert.equal(before.teacher.assist, undefined);
  const approval = { draft_id: draft.id, score: 8.25, feedback: 'Em hãy bổ sung tích đôi khi khai triển.' };
  assert.equal((await review(id, 'approve', approval)).status, 400);
  const decisions = [
    { id: 'e1', decision: 'confirmed', teacherCause: 'Chưa áp dụng tính phân phối', verificationEvidence: 'Em đã giải thích cách khai triển.' },
    { id: 'e2', decision: 'insufficient' },
  ];
  const approved = await review(id, 'approve', { ...approval, decisions });
  assert.equal(approved.status, 200);
  assert.equal(approved.body.teacher.assist.a.analysis.errors[0].teacherCause, decisions[0].teacherCause);
  const pupil = (await ownResult()).body.posts[0];
  assert.equal(pupil.teacher.score, approval.score);
  assert.equal(pupil.teacher.note, approval.feedback);
  assert.equal(pupil.teacher.assist, undefined);
  const peer = (await call('student_feed', { code: board.code, token: 'another-student-token' })).body.posts[0];
  assert.equal(peer.teacher.score, undefined);
  assert.equal(peer.teacher.note, undefined);
  await Promise.all(tasks);
});

test('V2 starts untouched work after a board is opted in, and never claims a paused or published submission', async () => {
  const { posts, activeBoard, due, tick, review, prompts } = setup({ serverAI: true });
  posts.push({
    id: 'old-ungraded', board_id: board.id, owner: board.owner, by: 'hs',
    body: '2x = 4 ⇒ x = 1', images: [], attachments: [], teacher: null,
  });
  due.push(posts[0].id);
  assert.equal((await tick()).body.processed, 0);
  assert.equal((await review(posts[0].id, 'run_analysis')).body.started, false);
  activeBoard.assignment.agentReviewV2 = true;
  assert.equal((await review(posts[0].id, 'claim')).body.job, null);
  assert.equal((await tick()).body.processed, 1);
  assert.equal(posts[0].teacher.assist.a.review.status, 'draft');
  assert.equal(posts[0].teacher.assist.agentReview.v2, true);
  assert.equal(prompts.length, 1);
  assert.equal((await tick()).body.processed, 0);
  const pending = { by: 'hs', body: 'Bài đang chờ', teacher: { assist: { agentReview: agent.pendingReviewJob('analysis', true) } } };
  assert.equal(agent.claimableReviewJob(pending, activeBoard, false), 'analysis');
  assert.equal(agent.claimableReviewJob({ ...pending, teacher: { ...pending.teacher, approvedAt: 1 } }, activeBoard, false), null);
  activeBoard.assignment.agentReviewV2 = false;
  assert.equal(agent.claimableReviewJob(pending, activeBoard, false), null);
});
test('V2 schedules only an authenticated server worker and reads source documents', () => {
  assert.match(server, /agent_review_cron_token/);
  assert.match(server, /x-agent-review-tick/);
  assert.match(server, /agent_review_v2_due_posts/);
  assert.match(server, /processed >= 2/);
  assert.match(server, /readOfficeText/);
  assert.match(server, /application\/pdf/);
  assert.match(server, /!v2EligibleBoard\(b\)/);
});


test('failed jobs require a retry and an older lease cannot publish a draft', async () => {
  const { submit, review } = setup();
  const id = (await submit()).body.post.id;
  const old = (await review(id, 'claim')).body.job;
  assert.equal((await review(id, 'fail', { lease: old.lease })).status, 200);
  assert.equal((await review(id, 'claim')).body.job, null);
  const current = (await review(id, 'claim', { retry: true })).body.job;
  assert.notEqual(current.lease, old.lease);
  assert.equal((await review(id, 'complete', { lease: old.lease, result: analysis })).status, 409);
  assert.equal((await review(id, 'complete', { lease: current.lease, result: analysis })).status, 200);
});

test('the teacher browser worker uses the claimed snapshot and the Firebase provider', async () => {
  const { submit, review, posts } = setup();
  const id = (await submit()).body.post.id;
  const rowToPost = (row) => ({ ...row, boardId: row.board_id, text: row.body });
  const local = new Map([[id, rowToPost(posts[0])]]);
  const worker = html.slice(html.indexOf('function adoptTeacherPatch('), html.indexOf('const asLocal ='));
  const run = vm.runInNewContext(worker + '\nrunAgentReview', {
    S: { posts: local, meId: board.owner }, isGV: () => true, getPost: (key) => local.get(key), getBoard: () => board,
    canManage: () => true, renderSoon: () => {}, canon: JSON.stringify, asSaved: (p) => p?.teacher?.assist,
    rowToPost, setInterval() {}, setTimeout() { return 1; }, document: { addEventListener() {} }, window: { addEventListener() {} },
    TuongAiAnswers: { payload: (context) => ({ context }) }, asDefaults: () => ({}), STOP_CODES: new Set(),
    api: async (action, { operation, post_id, ...input }) => {
      assert.equal(action, 'agent_review');
      const res = await review(post_id, operation, input);
      if (res.status !== 200) throw res.body.error;
      return res.body;
    },
    assistGoogle: async (kind, _payload, claimedPost, _signal, firebaseOnly) => {
      assert.equal(kind, 'analyze');
      assert.equal(claimedPost.text, '(a+b)² = a²+b²');
      assert.equal(firebaseOnly, true);
      return { analysis, model: 'fixture-model' };
    },
  });
  assert.equal(await run(id), true);
  assert.equal(local.get(id).teacher.assist.a.review.status, 'draft');
  assert.equal(local.get(id).teacher.approvedAt, undefined);
});

test('V2 private audit remains bounded and never includes student work', () => {
  let a = { agentReview: agent.pendingReviewJob('analysis') };
  for (let i = 0; i < 55; i++) a = agent.reviewAudit(a, 'claimed', 'analysis', 'server', 'rate_limited', 1000 + i);
  assert.equal(a.agentAudit.length, 40);
  assert.equal(a.agentAudit[0].at, 1015);
  assert.equal(a.agentAudit.at(-1).code, 'rate_limited');
  assert.equal(JSON.stringify(a).includes('(a+b)'), false);
});
test('V2 teacher dashboard only reveals operational metadata', () => {
  const post = { id: 'p', board_id: 'b', student_name: 'Học sinh thử', created_at: '2026-11-10',
    body: 'PRIVATE-STUDENT-ANSWER', student_token: 'PRIVATE-TOKEN',
    teacher: { assist: {
      agentReview: { kind: 'analysis', status: 'ready', attempts: 1 },
      agentAudit: [{ at: 1, event: 'completed', kind: 'analysis', actor: 'server', code: '' }],
      a: { review: { status: 'draft' }, analysis: { errors: [{ decision: 'pending' }] } },
    } } };
  const item = agent.reviewDashboardItem(post, { ...board, name: 'Bảng thử' });
  assert.equal(item.status, 'ready');
  assert.equal(item.reviewStatus, 'draft');
  assert.equal(item.audit.length, 1);
  assert.equal(JSON.stringify(item).includes('PRIVATE-'), false);
});

test('V2 dashboard renders an empty queue and opens each listed submission', async () => {
  const refresh = {}, start = {}, message = {};
  let buttons = [];
  let rendered = '';
  const out = {
    set innerHTML(markup) {
      rendered = markup;
      buttons = [...markup.matchAll(/data-open-agent-post="([^"]+)"/g)].map(([, id]) => ({
        dataset: { openAgentPost: id },
      }));
    },
    querySelector: () => buttons[0] ?? null,
    querySelectorAll: () => buttons,
  };
  const elements = { '#arv2-refresh': refresh, '#arv2-start': start, '#arv2-message': message, '#arv2-data': out };
  const opened = [];
  let items = [];
  const selectors = html.match(/^const \$\$? = .*$/gm).join('\n');
  const dashboard = html.slice(html.indexOf('function openAgentReviewDashboard()'), html.indexOf('async function schoolManagerFeatureAllowed'));
  const open = vm.runInNewContext(selectors + '\n' + dashboard + '\nopenAgentReviewDashboard', {
    isGV: () => true, S: {}, esc: String, fmt: String, aiMsg: (error) => error.message, setInterval() {},
    openModal: () => ({ el: { querySelector: (selector) => elements[selector] }, close() {} }),
    api: async (action, { operation }) => {
      assert.equal(action, 'agent_review_queue');
      assert.equal(operation, 'overview');
      return { items, counts: { pending: items.length }, aiReady: true };
    },
    getPost: (id) => items.find((item) => item.id === id),
    openDetail: (id, edit, focus) => opened.push([id, edit, focus]),
  });

  open();
  await new Promise(setImmediate);
  assert.match(message.textContent, /^Chưa có bài AgentReview V2/);
  assert.equal(start.disabled, true);

  items = [{ id: 'p1', status: 'pending' }, { id: 'p2', status: 'ready', reviewStatus: 'draft', suggestedScore: 0, maxScore: 10 }];
  await refresh.onclick();
  assert.match(message.textContent, /tự xử lý 2 bài đang chờ/);
  assert.match(rendered, /Điểm đề xuất 0 \/ 10/);
  assert.match(rendered, /Duyệt bản nháp/);
  assert.equal(start.disabled, false);
  for (const button of buttons) button.onclick();
  assert.deepEqual(opened, [['p1', false, 'agent-review'], ['p2', false, 'agent-review']]);
});

test('V2 opt-in boundary and teacher-scoped queue are present in backend', () => {
  assert.match(agentSource, /board\.assignment\?\.agentReviewV2 === true/);
  assert.match(server, /\.eq\("owner", owner\)\.eq\("by", "hs"\)/);
  assert.match(server, /case "agent_review_queue": return await handleAgentReviewQueue\(body, needActive\(me\)\)/);
  assert.match(server, /case "assign":/);
  assert.match(html, /id="bf-agent-v2"/);
  assert.match(html, /Trung tâm AgentReview V2/);
});
