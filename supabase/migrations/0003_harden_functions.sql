alter function public.touch() set search_path = public;
revoke execute on function public.claim_owner() from public, anon, authenticated;
revoke execute on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated;
