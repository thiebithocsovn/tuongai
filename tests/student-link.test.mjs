import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium, devices } from 'playwright';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const site = 'https://tuonghoctap.vercel.app';
const legacySite = 'https://thiebithocsovn.github.io/tuongai/';
const board = { id: 'test-board', code: 'ABC123', name: 'Lớp kiểm thử', layout: 'cot', auto_grade: false,
  columns: [{ id: 'assignment', name: 'Bài tập' }], assignment: { title: 'Bài 1', maxScore: 10 } };
const resultToken = 'private-result-token-for-test';
const uploadPath = 'teacher/test-board/student/file.txt';
const fileToken = 'signed-upload-token-for-test';
const post = { id: 'test-post', board_id: board.id, column_id: 'assignment', student_name: 'Học sinh thử',
  by: 'hs', visibility: 'mine', body: 'Bài làm thử', created_at: '2026-11-11T00:00:00Z' };
const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'apikey, content-type, authorization, x-upsert',
  'access-control-allow-methods': 'OPTIONS, POST, PUT',
};

async function studentPage(browser, device, { stallFeed = false, blockedStorage = false } = {}) {
  const context = await browser.newContext({ ...device, serviceWorkers: 'block' });
  const requests = [], uploads = [];
  if (blockedStorage) {
    await context.addInitScript(() => {
      for (const key of ['localStorage', 'sessionStorage']) {
        Object.defineProperty(window, key, { get() { throw new DOMException('Storage denied', 'SecurityError'); } });
      }
    });
  }
  let saved, sdkPending = false;
  await context.route('**/*', (route) => {
    const request = route.request(), url = new URL(request.url());
    if (request.isNavigationRequest() && (url.origin === site || url.href.startsWith(legacySite))) {
      return route.fulfill({ contentType: 'text/html; charset=utf-8', body: html });
    }
    // These requests never finish, as can happen in an embedded mobile browser.
    if (url.pathname.includes('/@supabase/supabase-js@')) { sdkPending = true; return; }
    if (url.hostname === 'fonts.googleapis.com' || url.pathname.endsWith('/file-preview.js')) return;
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const json = (body, status = 200) => route.fulfill({ status, headers: cors, json: body });
    if (url.pathname.endsWith('/functions/v1/tuongai')) {
      const data = request.postDataJSON();
      requests.push({ ...data, authorization: request.headers().authorization });
      if (data.code === 'CLOSED') return json({ error: { code: 'not_shared', message: 'Thầy cô đã tắt chia sẻ.' } }, 403);
      if (data.code === 'OLD123') return;
      switch (data.action) {
        case 'student_board': return json({ board, ai: false });
        case 'student_feed':
          if (stallFeed) { stallFeed = false; return; }
          return json({ board, posts: data.token === resultToken ? [post] : saved && saved.token === data.token ? [saved.post] : [], urls: {} });
        case 'student_mine': return json({ posts: data.token === resultToken ? [post] : [] });
        case 'student_prepare_attachment': return json({ path: uploadPath, token: fileToken, name: data.name, type: 'text/plain' });
        case 'student_submit':
          saved = { post: { ...post, attachments: data.attachments }, token: data.token };
          return json({ post: saved.post, urls: {} });
      }
    }
    if (url.pathname === '/storage/v1/object/upload/sign/work/' + uploadPath) {
      uploads.push({ token: url.searchParams.get('token'), method: request.method(), body: request.postData() });
      return json({ Key: 'work/' + uploadPath });
    }
    return route.abort();
  });
  return { context, page: await context.newPage(), requests, uploads, sdkPending: () => sdkPending };
}

async function assertBoard(page) {
  await page.locator('#view .fab[data-act="submit"]').waitFor({ state: 'visible', timeout: 5000 });
  assert.match(await page.locator('#view').innerText(), /Lớp kiểm thử/);
  assert.equal(await page.locator('#auth').isVisible(), false);
}

test('Student links open and submit independently of teacher authentication', async (t) => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  t.after(() => browser.close());

  await t.test('Android can open the direct link and submit an attachment with the SDK and storage unavailable', async (t) => {
    const { context, page, requests, uploads, sdkPending } = await studentPage(browser, devices['Pixel 7'], { blockedStorage: true });
    t.after(() => context.close());
    await page.goto(site + '/nop-bai/ABC123?source=zalo', { waitUntil: 'commit' });
    await assertBoard(page);
    assert.equal(sdkPending(), true);
    assert.equal(await page.evaluate(() => document.baseURI), site + '/');
    await page.locator('#view .fab[data-act="submit"]').click();
    await page.locator('#sf-student-name').fill('Học sinh thử');
    await page.locator('#sf-attachment-input').setInputFiles({ name: 'bai.txt', mimeType: 'text/plain', buffer: Buffer.from('Bai lam thu') });
    await page.locator('#sf-save').click();
    await page.getByText('Em đã nộp bài thành công!', { exact: true }).waitFor({ timeout: 5000 });
    assert.equal(uploads.length, 1);
    assert.equal(uploads[0].method, 'PUT');
    assert.equal(uploads[0].token, fileToken);
    assert.match(uploads[0].body, /Bai lam thu/);
    const submission = requests.find(request => request.action === 'student_submit');
    assert.equal(submission.code, board.code);
    assert.equal(submission.attachments[0].path, uploadPath);
    assert.ok(requests.every(request => !request.authorization));
  });

  await t.test('An old link opens the requested class before other saved classes', async (t) => {
    const { context, page, requests } = await studentPage(browser, devices['iPhone 13']);
    t.after(() => context.close());
    await context.addInitScript((guest) => localStorage.setItem('tuongai.guest', JSON.stringify(guest)), {
      id: 'student', name: 'Học sinh thử', token: resultToken, codes: ['OLD123', 'ABC123'],
    });
    await page.goto(legacySite + '?lop=abc123', { waitUntil: 'commit' });
    await assertBoard(page);
    assert.equal(requests[0].code, board.code);
  });

  await t.test('Private result links still restore the student and remove the secret fragment', async (t) => {
    const { context, page, requests } = await studentPage(browser, devices['iPhone 13']);
    t.after(() => context.close());
    await page.goto(site + '/nop-bai/ABC123#ketqua=' + resultToken, { waitUntil: 'commit' });
    await assertBoard(page);
    await page.waitForURL(site + '/nop-bai/ABC123', { waitUntil: 'commit', timeout: 5000 });
    assert.equal(requests.find(request => request.action === 'student_mine').token, resultToken);
    assert.match(await page.locator('#view').innerText(), /Bài làm thử/);
  });

  await t.test('The home page accepts a class code and a closed class displays its status', async (t) => {
    const { context, page } = await studentPage(browser, devices['Pixel 7']);
    t.after(() => context.close());
    await page.goto(site, { waitUntil: 'commit' });
    await page.getByRole('link', { name: 'vào lớp bằng mã' }).click({ noWaitAfter: true });
    await page.getByLabel('Mã lớp gồm 6 ký tự').fill('abc123');
    await page.getByRole('button', { name: 'Vào lớp', exact: true }).click({ noWaitAfter: true });
    await assertBoard(page);
    await page.goto(site + '/nop-bai/CLOSED', { waitUntil: 'commit' });
    await page.getByRole('heading', { name: 'Lớp chưa mở chia sẻ' }).waitFor({ timeout: 5000 });
    assert.equal(await page.locator('#auth').isVisible(), false);
    assert.equal(await page.getByRole('link', { name: 'Đăng nhập Tường học tập AI' }).getAttribute('href'), site + '/');
  });

  await t.test('A stalled class request offers a retry that reopens the same class', async (t) => {
    const { context, page } = await studentPage(browser, devices['Pixel 7'], { stallFeed: true });
    t.after(() => context.close());
    await page.clock.install();
    const feed = page.waitForRequest(request => request.url().endsWith('/functions/v1/tuongai') && request.postDataJSON()?.action === 'student_feed');
    await page.goto(site + '/nop-bai/ABC123', { waitUntil: 'commit' });
    await feed;
    assert.equal(await page.locator('#auth').isVisible(), false);
    await page.clock.fastForward(12050);
    await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
    await assertBoard(page);
  });
});
