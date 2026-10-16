-- Chỉ người đã đăng nhập mới gọi được các hàm kiểm tra quyền; hàm của trigger không gọi trực tiếp được.
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_active() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.is_active() to authenticated, service_role;
revoke execute on function public.profiles_guard() from public, anon, authenticated;
comment on table public.app_config is 'Cấu hình máy chủ (email quản trị, khóa AI). Cố ý không có chính sách: chỉ hàm máy chủ đọc bằng service role.';
