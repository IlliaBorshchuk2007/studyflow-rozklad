-- StudyFlow 2.5: secure group invitations with expiring one-time bearer tokens.
BEGIN;
CREATE TABLE IF NOT EXISTS public.group_invitations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
 token_hash bytea NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL,
 max_uses integer NOT NULL DEFAULT 1 CHECK (max_uses BETWEEN 1 AND 1000),
 uses integer NOT NULL DEFAULT 0 CHECK (uses>=0),
 revoked_at timestamptz,
 created_by uuid NOT NULL REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS group_invites_idx ON public.group_invitations(group_id,expires_at);
ALTER TABLE public.group_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.group_invitations FROM anon,authenticated;
GRANT SELECT,UPDATE ON public.group_invitations TO authenticated;
DROP POLICY IF EXISTS group_invite_admin_select ON public.group_invitations;
CREATE POLICY group_invite_admin_select ON public.group_invitations FOR SELECT TO authenticated USING(public.is_admin());
DROP POLICY IF EXISTS group_invite_admin_update ON public.group_invitations;
CREATE POLICY group_invite_admin_update ON public.group_invitations FOR UPDATE TO authenticated
 USING(public.is_admin()) WITH CHECK(public.is_admin());

CREATE OR REPLACE FUNCTION public.create_group_invitation(
 p_group uuid,p_expire_minutes integer DEFAULT 10080,p_uses integer DEFAULT 20)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE token text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Лише адміністратор може створювати запрошення'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.study_groups WHERE id=p_group) THEN RAISE EXCEPTION 'Група не існує'; END IF;
 IF p_expire_minutes NOT BETWEEN 15 AND 43200 OR p_uses NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Некоректний термін або обмеження'; END IF;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 INSERT INTO public.group_invitations(group_id,token_hash,expires_at,max_uses,created_by)
 VALUES(p_group,extensions.digest(token,'sha256'),now()+make_interval(mins=>p_expire_minutes),p_uses,auth.uid());
 RETURN token;
END $$;
REVOKE ALL ON FUNCTION public.create_group_invitation(uuid,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_group_invitation(uuid,integer,integer) TO authenticated;
CREATE OR REPLACE FUNCTION public.accept_group_invitation(p_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE inv public.group_invitations%ROWTYPE; added integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Увійди до акаунта'; END IF;
 IF (SELECT role FROM public.profiles WHERE id=auth.uid()) IS DISTINCT FROM 'student' THEN
 RAISE EXCEPTION 'Це запрошення призначене студентам'; END IF;
 IF length(coalesce(p_token,''))<>64 OR p_token!~'^[a-f0-9]{64}$' THEN
  RAISE EXCEPTION 'Неправильне посилання'; END IF;
 SELECT * INTO inv FROM public.group_invitations WHERE token_hash=extensions.digest(p_token,'sha256') FOR UPDATE;
 IF NOT FOUND OR inv.revoked_at IS NOT NULL OR inv.expires_at<=now() OR inv.uses>=inv.max_uses THEN
  RAISE EXCEPTION 'Запрошення недійсне, прострочене або вичерпане'; END IF;
 INSERT INTO public.group_members(group_id,user_id,member_role)
 VALUES(inv.group_id,auth.uid(),'student') ON CONFLICT (group_id,user_id) DO NOTHING;
 GET DIAGNOSTICS added=ROW_COUNT;
 IF added=1 THEN UPDATE public.group_invitations SET uses=uses+1 WHERE id=inv.id; END IF;
 RETURN inv.group_id;
END $$;
REVOKE ALL ON FUNCTION public.accept_group_invitation(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.accept_group_invitation(text) TO authenticated;
COMMIT;