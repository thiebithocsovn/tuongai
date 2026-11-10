// AgentReview uses the existing private teacher.assist review and practice records.
export class AgentReviewError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

type JobKind = "analysis" | "practice";
export const pendingReviewJob = (kind: JobKind) => ({ kind, status: "pending" });
export const reviewText = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export function confirmedPracticeInputs(review: any) {
  if (review?.review?.status !== "approved") return [];
  return (review.analysis?.errors || []).filter((e: any) =>
    e.decision === "confirmed" && reviewText(e.teacherCause, 1200) && reviewText(e.verificationEvidence, 1200)
  ).map((e: any) => ({
    id: e.id, skill: e.skill, evidence: e.evidence, cause: e.teacherCause,
    verification: e.verificationEvidence, remediation: e.remediation,
  }));
}

export function claimableReviewJob(post: any, board: any, retry: boolean, at = Date.now()): JobKind | null {
  const { agentReview: job, a } = post.teacher?.assist || {};
  if (post.by !== "hs" || !job || board.trashed || board.archived) return null;
  if (job.status !== "pending" && !(retry && job.status === "failed") &&
      !(job.status === "running" && job.until <= at)) return null;
  if (job.kind === "analysis" && board.auto_grade && !a &&
      (String(post.body || "").trim() || post.images?.length || post.attachments?.length)) return "analysis";
  if (job.kind === "practice" && post.teacher?.approvedAt && !a?.practice &&
      confirmedPracticeInputs(a).length) return "practice";
  return null;
}

export function makeReviewDraft(analysis: any, context: any, model: string, at: number, id: string) {
  return {
    id, at, model, ctx: context,
    analysis: { ...analysis, errors: analysis.errors.map((e: any) => ({
      ...e, decision: "pending", teacherCause: "", verificationEvidence: "",
    })) },
    review: { status: "draft", feedback: analysis.feedback || "", score: null, by: "", byName: "", at: 0 },
    practice: null,
  };
}

export function approveReviewDraft(draft: any, input: any, reviewer: { id: string; full_name: string }, max: number, at: number) {
  if (draft?.review?.status !== "draft" || !draft.id || draft.id !== input.draft_id ||
      !Array.isArray(draft.analysis?.errors))
    throw new AgentReviewError("stale_review", "Bản nháp đã thay đổi. Hãy tải bản đã lưu rồi duyệt.", 409);
  const decisions: any[] = Array.isArray(input.decisions) ? input.decisions : [];
  const byId = new Map(decisions.map((entry) => [entry?.id, entry]));
  if (decisions.length !== draft.analysis.errors.length || byId.size !== decisions.length)
    throw new AgentReviewError("verify_errors", "Hãy chọn kết luận cho từng lỗi trước khi duyệt.");
  const errors = draft.analysis.errors.map((error: any) => {
    const chosen = byId.get(error.id);
    const decision = chosen?.decision;
    if (!["confirmed", "rejected", "insufficient"].includes(decision))
      throw new AgentReviewError("verify_errors", "Hãy chọn kết luận cho từng lỗi trước khi duyệt.");
    const teacherCause = decision === "confirmed" ? reviewText(chosen.teacherCause, 1200) : "";
    const verificationEvidence = decision === "confirmed" ? reviewText(chosen.verificationEvidence, 1200) : "";
    if (decision === "confirmed" && (!teacherCause || !verificationEvidence))
      throw new AgentReviewError("verify_errors", "Lỗi được xác nhận cần nguyên nhân và căn cứ kiểm chứng của giáo viên.");
    return { ...error, decision, teacherCause, verificationEvidence };
  });
  const feedback = reviewText(input.feedback, 2000);
  if (!feedback) throw new AgentReviewError("need_feedback", "Hãy viết nhận xét trước khi duyệt.");
  if (!Number.isFinite(input.score) || input.score < 0 || input.score > max)
    throw new AgentReviewError("invalid_score", "Điểm cần từ 0 đến " + max + ".");
  const score = Math.min(max, Math.round(input.score * 4) / 4);
  return {
    ...draft, analysis: { ...draft.analysis, errors }, practice: null,
    review: { status: "approved", feedback, score, by: reviewer.id, byName: reviewer.full_name || "Giáo viên", at },
  };
}

export function cleanReviewPractice(raw: any, errors: { id: string }[]) {
  const ids = new Set(errors.map((e) => e.id));
  const exercises = (Array.isArray(raw?.exercises) ? raw.exercises : []).slice(0, 18)
    .filter((e: any) => ids.has(e?.errorId)).map((e: any, index: number) => ({
      id: "x" + (index + 1), errorId: e.errorId,
      difficulty: ["foundation", "application", "transfer"].includes(e.difficulty) ? e.difficulty : "foundation",
      question: reviewText(e.question, 2000), hint: reviewText(e.hint, 1200),
      expectedAnswer: reviewText(e.expectedAnswer, 2000), successCriteria: reviewText(e.successCriteria, 1200),
    })).filter((e: any) => e.question && e.hint && e.expectedAnswer && e.successCriteria);
  if (!ids.size || errors.some((e) => !exercises.some((x: any) => x.errorId === e.id)))
    throw new AgentReviewError("incomplete_practice", "AI chưa tạo đủ bài có đề, gợi ý và đáp án cho các lỗi đã xác nhận.", 502);
  return { instructions: reviewText(raw?.instructions, 2000), exercises };
}

/** Bounded private operational events; never include student work or API keys. */
export function reviewAudit(assist: any, event: string, kind: string, actor: string, code = "", at = Date.now()) {
  const history = Array.isArray(assist?.agentAudit) ? assist.agentAudit : [];
  return {
    ...assist,
    agentAudit: [...history.slice(-39), {
      at, event: String(event).slice(0, 32), kind: String(kind).slice(0, 20),
      actor: String(actor).slice(0, 72), code: String(code).slice(0, 64),
    }],
  };
}
export function reviewDashboardItem(post: any, boardName: string) {
  const assist = post.teacher?.assist || {};
  const job = assist.agentReview || {};
  const audit = Array.isArray(assist.agentAudit) ? assist.agentAudit : [];
  const errors = assist.a?.analysis?.errors || [];
  return {
    id: post.id, boardId: post.board_id, boardName, name: post.student_name,
    createdAt: post.created_at, kind: job.kind || "", status: job.status || "",
    attempts: Number(job.attempts || 0), lastCode: job.lastCode || "",
    reviewStatus: assist.a?.review?.status || "",
    practiceStatus: assist.a?.practice?.status || "",
    confirmedErrors: errors.filter((e: any) => e.decision === "confirmed").length,
    audit: audit.slice(-12),
  };
}
