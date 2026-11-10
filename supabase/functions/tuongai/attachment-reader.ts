// Bounded, server-side extraction of modern Office Open XML attachments.
// Does not upload files to third-party conversion services.
import { unzipSync, strFromU8 } from "npm:fflate@0.8.3";

export class AttachmentReadError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

const MAX_XML_FILE = 3_000_000;
const MAX_TOTAL_XML = 12_000_000;
const MAX_INPUT = 15_000_000;
const MAX_TEXT = 18_000;

function decodeXml(text: string): string {
  return text.replace(/&#(x[0-9a-f]+|[0-9]+);|&(amp|lt|gt|quot|apos);/gi, (match, numeric, named) => {
    if (numeric) {
      const code = numeric[0].toLowerCase() === "x"
        ? parseInt(numeric.slice(1), 16) : parseInt(numeric, 10);
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
        ? String.fromCodePoint(code) : "";
    }
    return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" } as Record<string, string>)[String(named).toLowerCase()] || match;
  });
}

function plainXml(xml: string): string {
  return decodeXml(xml
    .replace(/<\/(?:w:p|a:p|text:p)>/g, "\n")
    .replace(/<\/(?:w:tc|a:tc)>/g, "\t")
    .replace(/<w:tab\b[^>]*\/>/g, "\t")
    .replace(/<w:br\b[^>]*\/>/g, "\n")
    .replace(/<[^>]+>/g, "")
  ).replace(/[ \t]+\n/g, "\n").trim();
}

function pickZipFiles(bytes: Uint8Array, extension: "docx" | "xlsx"): Record<string, Uint8Array> {
  if (bytes.byteLength > MAX_INPUT) throw new AttachmentReadError("attachment_large", "Tệp Office vượt giới hạn đọc AI 15 MB.");
  let budget = 0, entries = 0;
  try {
    return unzipSync(bytes, { filter(file) {
      const n = file.name;
      const wanted = extension === "docx"
        ? n === "word/document.xml"
        : n === "xl/sharedStrings.xml" || n === "xl/workbook.xml" ||
          /^xl\/worksheets\/sheet[0-9]+\.xml$/.test(n);
      if (!wanted) return false;
      entries++;
      budget += Number(file.originalSize || 0);
      if (file.originalSize > MAX_XML_FILE || budget > MAX_TOTAL_XML || entries > 24) {
        throw new AttachmentReadError("attachment_complex", "Tệp Office có quá nhiều dữ liệu để AI đọc an toàn.");
      }
      return true;
    } });
  } catch (e) {
    if (e instanceof AttachmentReadError) throw e;
    throw new AttachmentReadError("attachment_corrupt", "Không giải nén được tệp Office. Hãy kiểm tra tệp.");
  }
}

function officeXmlFiles(bytes: Uint8Array, extension: "docx" | "xlsx"): Record<string, string> {
  const files = pickZipFiles(bytes, extension);
  const result: Record<string, string> = {};
  let budget = 0;
  for (const [name, content] of Object.entries(files)) {
    budget += content.byteLength;
    if (content.byteLength > MAX_XML_FILE || budget > MAX_TOTAL_XML) {
      throw new AttachmentReadError("attachment_complex", "Dung lượng dữ liệu giải nén vượt giới hạn an toàn.");
    }
    result[name] = strFromU8(content);
  }
  return result;
}

function readDocx(files: Record<string, string>): string {
  const xml = files["word/document.xml"];
  if (!xml) throw new AttachmentReadError("attachment_corrupt", "Word không có nội dung document.xml.");
  return plainXml(xml).slice(0, MAX_TEXT);
}

function cellValue(xml: string, kind: string, strings: string[]): string {
  const v = xml.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/)?.[1];
  if (kind === "s") return strings[Number(v)] || "";
  if (kind === "inlineStr") {
    return decodeXml([...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(x => x[1]).join(""));
  }
  if (kind === "b") return v === "1" ? "TRUE" : "FALSE";
  if (v !== undefined) return decodeXml(v);
  return "";
}

function readXlsx(files: Record<string, string>): string {
  const shared = [...(files["xl/sharedStrings.xml"] || "").matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)]
    .map((si) => decodeXml([...si[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
      .map(x => x[1]).join("")));
  const sheetNames = Object.keys(files).filter(n => /^xl\/worksheets\/sheet[0-9]+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/sheet([0-9]+)/)?.[1]) - Number(b.match(/sheet([0-9]+)/)?.[1]))
    .slice(0, 8);
  if (!sheetNames.length) throw new AttachmentReadError("attachment_corrupt", "Excel không có bảng tính đọc được.");
  const output: string[] = [];
  for (const name of sheetNames) {
    output.push("[Trang tính " + (name.match(/sheet([0-9]+)/)?.[1] || "?") + "]");
    const xml = files[name];
    let rows = 0;
    for (const row of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      if (++rows > 200) { output.push("…Đã giới hạn 200 dòng/trang tính."); break; }
      const cells: string[] = [];
      for (const cell of row[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
        if (cells.length >= 30) break;
        const position = cell[1].match(/\br="([^"]+)"/)?.[1] || "?";
        const kind = cell[1].match(/\bt="([^"]+)"/)?.[1] || "";
        const value = cellValue(cell[2], kind, shared);
        if (value.trim()) cells.push(position + "=" + value.slice(0, 500));
      }
      if (cells.length) output.push(cells.join(" | "));
      if (output.join("\n").length > MAX_TEXT) break;
    }
    if (output.join("\n").length > MAX_TEXT) break;
  }
  return output.join("\n").slice(0, MAX_TEXT).trim();
}

export function readOfficeText(extension: string, bytes: Uint8Array): string {
  if (extension !== "docx" && extension !== "xlsx")
    throw new AttachmentReadError("attachment_legacy", "Hãy chuyển Word .doc thành .docx hoặc Excel .xls thành .xlsx.");
  const files = officeXmlFiles(bytes, extension);
  const output = extension === "docx" ? readDocx(files) : readXlsx(files);
  if (!output.trim()) throw new AttachmentReadError("attachment_empty", "Tệp không chứa văn bản hoặc bảng tính đọc được.");
  return output;
}

export const AI_READABLE_EXTENSIONS = ["docx", "xlsx", "pdf", "txt", "csv", "jpg", "jpeg", "png", "webp"] as const;
