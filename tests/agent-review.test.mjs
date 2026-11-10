import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import * as agent from '../supabase/functions/tuongai/agent-review.ts';
import * as visibility from '../supabase/functions/tuongai/student-visibility.ts';
import * as references from '../supabase/functions/tuongai/answer-reference.ts';

const server = fs.readFileSync(new URL('../supabase/functions/tuongai/index.ts', import.meta.url), 'utf8');
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

function setup() {
  const posts = [];
  const profiles = ['teacher-1', 'teacher-2'].map((id) => ({ id, full_name: id, role: 'teacher', status: 'active' }));
  const rows = { posts, profiles, boards: [board], app_config: [], practice_submissions: [] };
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
        select() { return this; }, order() { return this; }, range() { return this; },
        eq(key, value) { filters.push((r) => r[key] === value); return this; },
        not(key) { assert.equal(key, 'teacher->>approvedAt'); filters.push((r) => !!r.teacher?.approvedAt); return this; },
        in() { return this; }, insert(row) { input = row; return this; },
        async single() { const data = result(); return { data: input ? data : data[0] }; },
        async maybeSingle() { return { data: result()[0] || null }; },
        then(resolve) { resolve({ data: result() }); },
      };
    },
    async rpc(name, args) {
      assert.equal(name, 'update_post_teacher_if_unchanged');
      const p = posts.find((row) => row.id === args.p_id && row.owner === args.p_owner && row.board_id === args.p_board);
      if (!p || JSON.stringify(p.teacher ?? null) !== JSON.stringify(args.p_expected_teacher) ||
          JSON.stringify([p.body, p.images, p.attachments]) !== JSON.stringify(args.p_expected_work)) return { data: false };
      p.teacher = asJson(args.p_teacher);
      return { data: true };
    },
  };
  const compiled = stripTypeScriptTypes(server.replace(/^import [\s\S]*?;\n/gm, ''), { mode: 'transform' });
  vm.runInNewContext(compiled, {
    ...agent, ...references, ...visibility, publicPost: visibility.studentPost, crypto, Request, Response, TextEncoder,
    createClient: () => db, Deno: { env: { get: () => '' }, serve: (fn) => { handler = fn; } },
  });
  const call = async (action, input, user) => {
    const response = await handler(new Request('https://example.test/functions/v1/tuongai', {
      method: 'POST', headers: user ? { authorization: 'Bearer ' + user } : {},
      body: JSON.stringify({ action, ...input }),
    }));
    return { status: response.status, body: await response.json() };
  };
  const submit = () => call('student_submit', { code: board.code, name: 'Học sinh thử', token, text: '(a+b)² = a²+b²' });
  const review = (id, operation, input = {}, user = board.owner) => call('agent_review', { post_id: id, operation, ...input }, user);
  return { submit, review, call, posts };
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
  const item = agent.reviewDashboardItem(post, 'Bảng thử');
  assert.equal(item.status, 'ready');
  assert.equal(item.reviewStatus, 'draft');
  assert.equal(item.audit.length, 1);
  assert.equal(JSON.stringify(item).includes('PRIVATE-'), false);
});
test('V2 opt-in boundary and teacher-scoped queue are present in backend', () => {
  assert.match(server, /board\.assignment\?\.agentReviewV2 === true/);
  assert.match(server, /\.eq\("owner", owner\)\.eq\("by", "hs"\)/);
  assert.match(server, /case "agent_review_queue": return await handleAgentReviewQueue\(body, needActive\(me\)\)/);
  assert.match(server, /case "assign":/);
  assert.match(html, /id="bf-agent-v2"/);
  assert.match(html, /Trung tâm AgentReview V2/);
});
