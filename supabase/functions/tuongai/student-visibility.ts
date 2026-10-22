/* Chỉ bài giáo viên giao mới công khai ngay; bài chụp hộ học sinh vẫn cần duyệt. */
export function isTeacherAnnouncement(p: any, ownerName = ""): boolean {
  if (!p || p.by !== "gv") return false;
  if (p.teacher?.postType === "announcement") return true;
  if (p.teacher?.postType) return false;
  // Bài giao trước khi triển khai postType chỉ có tên của giáo viên tạo lớp.
  const studentName = String(p.student_name || "").trim().toLocaleLowerCase("vi");
  return !!(ownerName && studentName && studentName === String(ownerName).trim().toLocaleLowerCase("vi"));
}

/* Explicit student response fields: never serialize raw rows or teacher.assist. */
export function studentPost(p: any, mine = true, ownerName = "") {
  const approved = !!p.teacher?.approvedAt;
  const teacherPost = isTeacherAnnouncement(p, ownerName);
  const graded = !!(p.ai || p.ai_at || approved || typeof p.teacher?.score === "number");
  const teacher: any = {
    pinned: !!p.teacher?.pinned,
    color: p.teacher?.color || "",
    postType: teacherPost ? "announcement" : p.teacher?.postType === "student_work" ? "student_work" : "",
  };
  if (approved) {
    teacher.approvedAt = p.teacher.approvedAt;
    teacher.note = typeof p.teacher.note === "string" ? p.teacher.note : "";
    teacher.comments = (Array.isArray(p.teacher.comments) ? p.teacher.comments : []).map((c: any) => ({
      id: c.id, name: c.name, text: c.text, at: c.at,
    }));
    if (mine && typeof p.teacher.score === "number") teacher.score = p.teacher.score;
  }
  return {
    id: p.id, board_id: p.board_id, column_id: p.column_id,
    student_name: p.student_name, student_class: p.student_class,
    by: p.by, body: p.body, images: p.images || [],
    attachments: (p.attachments || []).map((a: any) => {
      const previewable = /\.(pdf|docx|xlsx?|txt|csv|mp4|mov|webm|mp3|m4a|wav)$/i.test(a.name || "");
      return { name: a.name, type: a.type, size: a.size, path: mine || teacherPost || previewable ? a.path : "", viewOnly: !mine && !teacherPost };
    }),
    ai: mine && approved ? p.ai : null,
    ai_at: mine && approved ? p.ai_at : null,
    teacher, created_at: p.created_at,
    visibility: mine ? "mine" : "class", graded,
    editable: mine && p.by === "hs" && !graded,
  };
}

export const ownsStudentPost = (p: any, token: string) => token.length >= 16 && p.student_token === token;
// Giáo viên đăng bài lên lớp: công khai ngay, không đợi duyệt bài học sinh.
export const visibleToStudent = (p: any, token: string, ownerName = "") => ownsStudentPost(p, token) || isTeacherAnnouncement(p, ownerName) || !!p.teacher?.approvedAt;
