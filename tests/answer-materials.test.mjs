import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire, stripTypeScriptTypes} from 'node:module';
import Answers from '../answer-materials.js';
import {answerReference, answerImages, answerImageRules} from '../supabase/functions/tuongai/answer-reference.ts';
import {studentPost} from '../supabase/functions/tuongai/student-visibility.ts';

const require = createRequire(import.meta.url);
const mammoth = require('mammoth/mammoth.browser.js');
const JSZip = require('jszip');
const XLSX = require('xlsx');
const {DOMParser} = require('@xmldom/xmldom');
const image = {mime:'image/png', data:'cmVm'};
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const section = (a, b) => { const start = html.indexOf(a), end = html.indexOf(b, start); assert.ok(start >= 0 && end > start); return html.slice(start, end); };
const context = {subject:'Toán', grade:'8', task:'Giải phương trình', criteria:'Đúng phương pháp: 2 điểm', transcript:'',
  answerFiles:[{name:'Dap-an.docx', text:'Đáp án: x = 2. Mỗi bước 1 điểm.', images:[image]}]};

test('Word DOCX paragraphs, tables and embedded answer images are actually read', async () => {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/_rels/document.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rImg" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/answer.png"/></Relationships>');
  zip.file('word/media/answer.png', Buffer.from(image.data, 'base64'));
  zip.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body><w:p><w:r><w:t>ĐÁP ÁN: x = 2</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Câu 1: 2 điểm</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p><w:r><w:drawing><wp:inline><wp:docPr id="1" name="Answer image"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:blipFill><a:blip r:embed="rImg"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p></w:body></w:document>');
  const original = await zip.file('word/document.xml').async('string');
  zip.file('word/document.xml', original.replace('<w:document ', '<w:document xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" ').replace('</w:body>', '<w:p><w:r><w:t>Câu 2: </w:t></w:r><m:oMath><m:f><m:num><m:r><m:t>1</m:t></m:r></m:num><m:den><m:r><m:t>2</m:t></m:r></m:den></m:f><m:r><m:t> + </m:t></m:r><m:sSup><m:e><m:r><m:t>x</m:t></m:r></m:e><m:sup><m:r><m:t>2</m:t></m:r></m:sup></m:sSup></m:oMath></w:p></w:body>'));
  const buffer = await zip.generateAsync({type:'arraybuffer'});
  const parsed = await Answers.read(new File([buffer], 'Dap-an.docx'), {docx:b => Answers.readDocx(b, mammoth, async (data, mime) => ({data, mime}), data => Answers.readWordMath(data, JSZip, xml => new DOMParser().parseFromString(xml, 'application/xml')))});
  assert.match(parsed.text, /ĐÁP ÁN: x = 2/);
  assert.match(parsed.text, /Câu 1: 2 điểm/);
  assert.equal(parsed.images[0].data, image.data);
  assert.match(parsed.text, /Câu 2: \(1\)\/\(2\) \+ \(x\)\^\(2\)/);
});

function makePdf(count = 1) {
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', ''];
  const kids = [];
  for (let i = 0; i < count; i++) {
    const page = objects.length + 1, content = page + 1;
    kids.push(page + ' 0 R');
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents ${content} 0 R >>`);
    const stream = 'BT /F1 12 Tf 20 100 Td (Answer: x = 2) Tj ET';
    objects.push('<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream');
  }
  objects[1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${count} >>`;
  let output = '%PDF-1.4\n', offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(output)); output += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const start = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + offsets.slice(1).map(offset => String(offset).padStart(10, '0') + ' 00000 n \n').join('');
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return Uint8Array.from(Buffer.from(output)).buffer;
}
test('PDF text is read and every page is also supplied as an answer image, including scan pages', async () => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  let pages = 0;
  const parsed = await Answers.readPdf(makePdf(2), pdfjs, async page => {pages++; assert.ok(page.getViewport({scale:1}).width > 0); return image;});
  assert.match(parsed.text, /Answer: x = 2/); assert.equal(pages, 2); assert.equal(parsed.images.length, 2);
  await assert.rejects(Answers.readPdf(makePdf(9), pdfjs, async () => image), /8 trang/);
});

test('Excel answers and UTF-16 text files retain Vietnamese content', async () => {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Câu', 'Đáp án', 'Điểm'], [1, 'x = 2', 2]]), 'Đáp án');
  for (const kind of ['xlsx', 'xls']) {
    const bytes = XLSX.write(book, {type:'array', bookType:kind === 'xls' ? 'biff8' : 'xlsx'});
    const parsed = await Answers.read(new File([bytes], 'Dap-an.' + kind), {spreadsheet:async b => Answers.readSpreadsheet(b, XLSX)});
    assert.match(parsed.text, /Đáp án/); assert.match(parsed.text, /x = 2/);
  }
  const text = await Answers.read(new File([Buffer.from('\ufeffĐáp án: x = 2', 'utf16le')], 'Dap-an.txt'), {});
  assert.equal(text.text, 'Đáp án: x = 2');
});

test('Bad formats, oversized files, too many pages and oversized reference payloads fail explicitly', async () => {
  await assert.rejects(Answers.read(new File(['old Word'], 'Dap-an.doc'), {}), /\.docx hoặc PDF/);
  await assert.rejects(Answers.read({name:'large.pdf', size:21*1024*1024}, {}), /20 MB/);
  assert.throws(() => Answers.normalize(Array(6).fill({text:'x'})), /5 tệp/);
  assert.throws(() => Answers.normalize([{text:'x', images:Array(9).fill(image)}]), /8 ảnh/);
  assert.throws(() => Answers.normalize([{text:'x'.repeat(24001)}]), /24.000/);
  assert.throws(() => answerImages([{mime:'image/svg+xml', data:image.data}]), /không hợp lệ/);
  assert.throws(() => answerImages([{...image, data:'a'.repeat(3000004)}]), /quá lớn/);
});

test('Client and server keep reference text separate from student work and agree on image order', () => {
  const client = Answers.payload(context), server = answerReference(context);
  assert.equal(client.context.answerText, server.context.answerText);
  assert.deepEqual(client.answer_images, server.images);
  assert.equal(client.context.transcript, '');
  assert.equal('answerFiles' in client.context, false);
  assert.equal(JSON.stringify(client.context).includes(image.data), false);
  assert.equal(Answers.imageRules(2, 1), answerImageRules(2, 1));
});

test('AI analysis receives answer images even when student images are switched off, and never grades an answer-only submission', async () => {
  let sent;
  const assist = vm.runInNewContext(section('const ASSIST_RULES =', 'async function gradePost(') + '\nassistGoogle', {
    TuongAiAnswers:Answers, postImagesB64:async () => [{mime:'image/jpeg', data:'c3R1ZGVudA=='}], provModel:() => 'test-model',
    aiJson:async (prompt, images) => {sent = {prompt, images}; return {summary:'Bài làm có căn cứ', errors:[]};},
  });
  await assist('analyze', {...Answers.payload(context), include_media:false}, {text:'Em tính được x = 3'});
  assert.match(sent.prompt, /Em tính được x = 3/); assert.match(sent.prompt, /Đáp án: x = 2/);
  assert.match(sent.prompt, /0 ảnh đầu.*1 ảnh cuối/); assert.equal(sent.images.length, 1);
  assert.equal(sent.images[0].data, image.data);
  await assert.rejects(assist('analyze', {...Answers.payload(context), include_media:false}, {text:''}), error => error.code === 'empty');
});

test('The normal grading button and server grading prompt both use saved answer documents', async () => {
  const post = {text:'Em làm x = 3', teacher:{assist:{ctx:context}}};
  let sent;
  const grade = vm.runInNewContext(section('async function gradeGoogle(', '/* ----- Trợ lý AI') + '\ngradeGoogle', {
    TuongAiAnswers:Answers, postImagesB64:async () => [], gradePrompt:() => 'CHẤM BÀI HỌC SINH',
    aiJson:async (prompt, images) => {sent = {prompt, images}; return {diem:1};}, cleanGrade:r => r,
  });
  await grade(post, {assignment:{maxScore:10}});
  assert.match(sent.prompt, /Đáp án: x = 2/); assert.equal(sent.images[0].data, image.data);
  const server = fs.readFileSync(new URL('../supabase/functions/tuongai/index.ts', import.meta.url), 'utf8');
  const code = server.slice(server.indexOf('function buildPrompt('), server.indexOf('function cleanAI('));
  const prompt = vm.runInNewContext(stripTypeScriptTypes(code) + '\nbuildPrompt', {answerReference, answerImageRules});
  const text = prompt({assignment:{maxScore:10}}, {...post, body:post.text}, 1);
  assert.match(text, /Đáp án: x = 2/); assert.match(text, /1 ảnh đầu.*1 ảnh cuối/);
});

test('Reading and saving answers writes the teacher context; save failures keep the parsed work available', async () => {
  let saved, fail = false;
  const add = vm.runInNewContext(section('async function answerImage(', 'function assistMount(') + '\nasAddAnswers', {
    TuongAiAnswers:Answers, asRender() {}, uid:() => 'answer-id',
    asPersist:async as => {saved = JSON.parse(JSON.stringify(as.ctx)); return !fail;},
  });
  const as = {ctx:{}, busy:'', ext:false};
  await add(as, [new File(['Đáp án: x = 2'], 'Dap-an.txt')]);
  assert.equal(saved.answerFiles[0].text, 'Đáp án: x = 2'); assert.equal(as.err, '');
  fail = true;
  await add(as, [new File(['Câu 2: y = 3'], 'Cau-2.txt')]);
  assert.equal(as.ctx.answerFiles.length, 2); assert.match(as.err, /chưa lưu được/);
});

test('Answer documents are never serialized into student responses, before or after approval', () => {
  for (const mine of [true, false]) for (const approved of [true, false]) {
    const response = studentPost({id:'p', teacher:{assist:{ctx:context}, approvedAt:approved ? 1 : undefined}}, mine);
    const serialized = JSON.stringify(response);
    for (const secret of ['Dap-an.docx', 'Đáp án: x = 2', image.data, 'answerFiles']) assert.equal(serialized.includes(secret), false);
  }
});

test('Clipboard images are accepted only in the answer paste area and file selection uses the same reader', () => {
  const events = {}, received = [];
  const element = {setAttribute() {}, addEventListener:(type, handler) => {events[type] = handler;}};
  const mount = vm.runInNewContext(section('function assistMount(', 'function asField(') + '\nassistMount', {
    getBoard:() => ({}), asSaved:() => null, document:{createElement:() => element}, asDefaults:() => ({}),
    asLocal:v => v, canon:JSON.stringify, asSimilarDefaults:() => ({}), clone:v => v, asRender() {},
    asField() {}, asAddAnswers:(as, files) => received.push(files),
  });
  const as = mount({id:'p'}), file = new File(['image'], 'answer.png', {type:'image/png'});
  let prevented = false;
  events.paste({target:{closest:() => null}, clipboardData:{files:[file]}, preventDefault:() => {prevented = true;}});
  assert.equal(received.length, 0); assert.equal(prevented, false);
  events.paste({target:{closest:() => ({})}, clipboardData:{files:[file]}, preventDefault:() => {prevented = true;}});
  assert.equal(received[0][0], file); assert.equal(prevented, true);
  events.change({target:{matches:() => true, files:[file], value:'file'}});
  assert.equal(received[1][0], file);
  as.busy = 'answers';
  events.paste({target:{closest:() => ({})}, clipboardData:{files:[file]}, preventDefault() {}});
  assert.equal(received.length, 2);
});

test('The request sent to the existing server includes reference images without embedding binary data in the prompt context', async () => {
  let request;
  const call = vm.runInNewContext(section('async function asCall(', 'function asSheet(') + '\nasCall', {
    TuongAiAnswers:Answers, AbortController, clientProv:() => false,
    api:async (action, payload) => {request = {action, payload}; return {ok:true};},
  });
  await call({id:'p'}, 'analyze', {post_id:'p', context, include_media:false});
  assert.equal(request.action, 'assist');
  assert.equal(request.payload.answer_images[0].data, image.data);
  assert.match(request.payload.context.answerText, /x = 2/);
  assert.equal('answerFiles' in request.payload.context, false);
});
