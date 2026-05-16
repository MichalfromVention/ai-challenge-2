CREATE OR REPLACE FUNCTION public.redeem_invite(_token text)
 RETURNS TABLE(host_id uuid, role text, already_member boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_uid UUID := auth.uid(); v_inv RECORD; v_ex RECORD;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_inv FROM public.host_invites hi WHERE hi.token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid invite'; END IF;
  SELECT * INTO v_ex FROM public.host_members hm WHERE hm.host_id=v_inv.host_id AND hm.user_id=v_uid;
  IF FOUND THEN
    host_id := v_inv.host_id; role := v_ex.role; already_member := true; RETURN NEXT; RETURN;
  END IF;
  INSERT INTO public.host_members (host_id, user_id, role) VALUES (v_inv.host_id, v_uid, v_inv.role)
    ON CONFLICT (host_id, user_id) DO NOTHING;
  UPDATE public.host_invites SET used_at = now() WHERE id = v_inv.id AND used_at IS NULL;
  host_id := v_inv.host_id; role := v_inv.role; already_member := false; RETURN NEXT;
END; $function$;