
REVOKE EXECUTE ON FUNCTION public.invite_group_member(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.respond_group_invite(uuid, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.my_group_invites() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_accepted_group_member(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.invite_group_member(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_group_invite(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_group_invites() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_accepted_group_member(uuid, uuid) TO authenticated;
