
-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles insert own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  RETURN new;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- HOSTS
CREATE TABLE public.hosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  logo_url TEXT,
  bio TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE
);
ALTER TABLE public.hosts ENABLE ROW LEVEL SECURITY;

-- HOST_MEMBERS
CREATE TABLE public.host_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES public.hosts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('host','checker')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(host_id, user_id)
);
ALTER TABLE public.host_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_host_member(_user_id UUID, _host_id UUID, _role TEXT DEFAULT NULL)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.host_members
    WHERE host_id = _host_id AND user_id = _user_id
    AND (_role IS NULL OR role = _role));
$$;

CREATE POLICY "hosts select" ON public.hosts FOR SELECT USING (true);
CREATE POLICY "hosts update" ON public.hosts FOR UPDATE TO authenticated
  USING (public.is_host_member(auth.uid(), id, 'host'));
CREATE POLICY "hm select" ON public.host_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_host_member(auth.uid(), host_id, NULL));
CREATE POLICY "hm delete" ON public.host_members FOR DELETE TO authenticated
  USING (public.is_host_member(auth.uid(), host_id, 'host') AND user_id <> auth.uid());

-- EVENTS
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES public.hosts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Europe/Warsaw',
  venue_address TEXT,
  online_link TEXT,
  capacity INTEGER NOT NULL DEFAULT 50 CHECK (capacity >= 1),
  cover_image_url TEXT,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','unlisted')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  is_paid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_event_team(_user_id UUID, _event_id UUID, _role TEXT DEFAULT NULL)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.events e
    JOIN public.host_members hm ON hm.host_id = e.host_id
    WHERE e.id = _event_id AND hm.user_id = _user_id
    AND (_role IS NULL OR hm.role = _role));
$$;

CREATE POLICY "events select" ON public.events FOR SELECT
  USING (
    (status = 'published')
    OR (auth.uid() IS NOT NULL AND public.is_host_member(auth.uid(), host_id, NULL))
  );
CREATE POLICY "events insert" ON public.events FOR INSERT TO authenticated
  WITH CHECK (public.is_host_member(auth.uid(), host_id, 'host'));
CREATE POLICY "events update" ON public.events FOR UPDATE TO authenticated
  USING (public.is_host_member(auth.uid(), host_id, 'host'));
CREATE POLICY "events delete" ON public.events FOR DELETE TO authenticated
  USING (public.is_host_member(auth.uid(), host_id, 'host'));

-- RSVPS
CREATE TABLE public.rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('going','waitlisted','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ticket_code TEXT UNIQUE,
  checked_in_at TIMESTAMPTZ,
  promoted_at TIMESTAMPTZ,
  UNIQUE(event_id, user_id)
);
ALTER TABLE public.rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rsvps select" ON public.rsvps FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_event_team(auth.uid(), event_id, NULL));
CREATE POLICY "rsvps insert" ON public.rsvps FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status IN ('going','waitlisted'));
CREATE POLICY "rsvps update" ON public.rsvps FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_event_team(auth.uid(), event_id, NULL));

CREATE OR REPLACE FUNCTION public.generate_ticket_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; code TEXT; i INT; c INT;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..8 LOOP code := code || substr(chars, 1+floor(random()*length(chars))::int, 1); END LOOP;
    SELECT count(*) INTO c FROM public.rsvps WHERE ticket_code = code;
    EXIT WHEN c = 0;
  END LOOP;
  RETURN code;
END; $$;

CREATE OR REPLACE FUNCTION public.rsvp_assign_ticket()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'going' AND (NEW.ticket_code IS NULL OR NEW.ticket_code = '') THEN
    NEW.ticket_code := public.generate_ticket_code();
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_rsvp_ticket_ins BEFORE INSERT ON public.rsvps
  FOR EACH ROW EXECUTE FUNCTION public.rsvp_assign_ticket();
CREATE TRIGGER trg_rsvp_ticket_upd BEFORE UPDATE ON public.rsvps
  FOR EACH ROW EXECUTE FUNCTION public.rsvp_assign_ticket();

CREATE OR REPLACE FUNCTION public.promote_waitlist()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cap INT; v_going INT; v_pid UUID;
BEGIN
  IF (TG_OP='UPDATE' AND OLD.status='going' AND NEW.status='cancelled') THEN
    SELECT capacity INTO v_cap FROM public.events WHERE id = NEW.event_id;
    SELECT count(*) INTO v_going FROM public.rsvps WHERE event_id = NEW.event_id AND status='going';
    IF v_going < v_cap THEN
      SELECT id INTO v_pid FROM public.rsvps WHERE event_id=NEW.event_id AND status='waitlisted'
        ORDER BY created_at ASC LIMIT 1;
      IF v_pid IS NOT NULL THEN
        UPDATE public.rsvps SET status='going', ticket_code=public.generate_ticket_code(), promoted_at=now()
          WHERE id = v_pid;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_promote_waitlist AFTER UPDATE ON public.rsvps
  FOR EACH ROW EXECUTE FUNCTION public.promote_waitlist();

-- HOST_INVITES
CREATE TABLE public.host_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES public.hosts(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('host','checker')),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ
);
ALTER TABLE public.host_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv select" ON public.host_invites FOR SELECT TO authenticated
  USING (public.is_host_member(auth.uid(), host_id, 'host'));
CREATE POLICY "inv insert" ON public.host_invites FOR INSERT TO authenticated
  WITH CHECK (public.is_host_member(auth.uid(), host_id, 'host') AND created_by = auth.uid());
CREATE POLICY "inv delete" ON public.host_invites FOR DELETE TO authenticated
  USING (public.is_host_member(auth.uid(), host_id, 'host'));

-- PHOTOS
CREATE TABLE public.photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "photos select" ON public.photos FOR SELECT
  USING (approved = true OR (auth.uid() IS NOT NULL AND (user_id = auth.uid() OR public.is_event_team(auth.uid(), event_id, NULL))));
CREATE POLICY "photos insert" ON public.photos FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (
    public.is_event_team(auth.uid(), event_id, NULL)
    OR EXISTS (SELECT 1 FROM public.rsvps r JOIN public.events e ON e.id=r.event_id
      WHERE r.event_id=photos.event_id AND r.user_id=auth.uid() AND r.status='going' AND e.end_at < now())
  ));
CREATE POLICY "photos update" ON public.photos FOR UPDATE TO authenticated
  USING (public.is_event_team(auth.uid(), event_id, NULL));
CREATE POLICY "photos delete" ON public.photos FOR DELETE TO authenticated
  USING (public.is_event_team(auth.uid(), event_id, NULL) OR user_id = auth.uid());

-- FEEDBACK
CREATE TABLE public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fb select" ON public.feedback FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_event_team(auth.uid(), event_id, NULL));
CREATE POLICY "fb insert" ON public.feedback FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.rsvps r JOIN public.events e ON e.id=r.event_id
    WHERE r.event_id=feedback.event_id AND r.user_id=auth.uid() AND r.status='going' AND e.end_at < now()
  ));

-- REPORTS
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL CHECK (target_type IN ('event','photo')),
  target_id UUID NOT NULL,
  reporter_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT,
  hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rep insert" ON public.reports FOR INSERT TO authenticated
  WITH CHECK (reporter_user_id = auth.uid());
CREATE POLICY "rep select" ON public.reports FOR SELECT TO authenticated
  USING (
    (target_type='event' AND public.is_event_team(auth.uid(), target_id, 'host'))
    OR (target_type='photo' AND EXISTS (SELECT 1 FROM public.photos p WHERE p.id=reports.target_id AND public.is_event_team(auth.uid(), p.event_id, 'host')))
  );
CREATE POLICY "rep update" ON public.reports FOR UPDATE TO authenticated
  USING (
    (target_type='event' AND public.is_event_team(auth.uid(), target_id, 'host'))
    OR (target_type='photo' AND EXISTS (SELECT 1 FROM public.photos p WHERE p.id=reports.target_id AND public.is_event_team(auth.uid(), p.event_id, 'host')))
  );

-- RPCs
CREATE OR REPLACE FUNCTION public.become_host(_display_name TEXT, _bio TEXT DEFAULT '', _contact_email TEXT DEFAULT '')
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid(); v_id UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  INSERT INTO public.hosts (display_name, bio, contact_email, created_by)
    VALUES (_display_name, COALESCE(_bio,''), COALESCE(_contact_email,''), v_uid) RETURNING id INTO v_id;
  INSERT INTO public.host_members (host_id, user_id, role) VALUES (v_id, v_uid, 'host');
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.redeem_invite(_token TEXT)
RETURNS TABLE(host_id UUID, role TEXT, already_member BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid(); v_inv RECORD; v_ex RECORD;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_inv FROM public.host_invites WHERE token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid invite'; END IF;
  SELECT * INTO v_ex FROM public.host_members WHERE host_id=v_inv.host_id AND user_id=v_uid;
  IF FOUND THEN
    host_id := v_inv.host_id; role := v_ex.role; already_member := true; RETURN NEXT; RETURN;
  END IF;
  INSERT INTO public.host_members (host_id, user_id, role) VALUES (v_inv.host_id, v_uid, v_inv.role)
    ON CONFLICT (host_id, user_id) DO NOTHING;
  UPDATE public.host_invites SET used_at = now() WHERE id = v_inv.id AND used_at IS NULL;
  host_id := v_inv.host_id; role := v_inv.role; already_member := false; RETURN NEXT;
END; $$;

CREATE OR REPLACE FUNCTION public.export_event_rsvps(_event_id UUID)
RETURNS TABLE(name TEXT, email TEXT, rsvp_status TEXT, checked_in_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_event_team(v_uid, _event_id, NULL) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
    SELECT p.display_name, u.email::TEXT, r.status, r.checked_in_at
    FROM public.rsvps r
    JOIN public.profiles p ON p.id=r.user_id
    JOIN auth.users u ON u.id=r.user_id
    WHERE r.event_id = _event_id ORDER BY r.created_at;
END; $$;

-- STORAGE BUCKETS
INSERT INTO storage.buckets (id, name, public) VALUES
  ('cover-images','cover-images', true),
  ('host-logos','host-logos', true),
  ('event-photos','event-photos', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "storage read" ON storage.objects FOR SELECT
  USING (bucket_id IN ('cover-images','host-logos','event-photos'));
CREATE POLICY "storage write own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('cover-images','host-logos','event-photos')
    AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "storage update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('cover-images','host-logos','event-photos')
    AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "storage delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('cover-images','host-logos','event-photos')
    AND (storage.foldername(name))[1] = auth.uid()::text);
