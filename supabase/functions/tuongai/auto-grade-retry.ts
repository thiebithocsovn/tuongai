// Pure, bounded policy for retrying temporary Gemini grading failures.
// Messages are intentionally fixed: never store upstream body, API keys or student work.
export const AUTO_GRADE_RETRY_MS = [8_000, 20_000] as const;
export type AutoGradeFailure = { code: string; message: string; retryable: boolean };
const LABELS: Record<string, string> = {
  rate_limited: "Gemini đang quá hạn mức hoặc bận (429/503).",
  upstream_error: "Kết nối Gemini bị gián đoạn.",
  network: "Không kết nối được máy chủ Gemini.",
  timeout: "Gemini phản hồi quá thời gian.",
  empty_completion: "Gemini chưa trả nội dung chấm.",
  bad_key: "Khóa Gemini chưa hợp lệ.",
  bad_model: "Mô hình Gemini không khả dụng.",
  invalid_json: "Gemini trả kết quả chưa đúng định dạng.",
  stale_submission: "Bài đã thay đổi trong lúc chấm.",
  no_grade_input: "Bài chưa có văn bản hoặc ảnh để AI đọc.",
  worker_error: "Máy chủ chưa hoàn tất chấm AI.",
};
const RETRYABLE = new Set(["rate_limited", "upstream_error", "network", "timeout", "empty_completion"]);
export function gradeFailure(e: unknown): AutoGradeFailure {
  const raw = typeof (e as {code?:unknown})?.code === "string" ? (e as {code:string}).code : "";
  const code = Object.prototype.hasOwnProperty.call(LABELS, raw) ? raw
    : (e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError")) ? "timeout"
    : e instanceof TypeError ? "network" : "worker_error";
  return { code, message: LABELS[code], retryable: RETRYABLE.has(code) };
}
export function gradeAttemptsValid(value: unknown): number {
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 1 && n <= 3 ? n : 1;
}
