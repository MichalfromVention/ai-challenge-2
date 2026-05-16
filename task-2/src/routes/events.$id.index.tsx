import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ReportDialog } from "@/components/ReportDialog";
import { TicketCard } from "@/components/TicketCard";
import { fmtDate, isPast, downloadICS } from "@/lib/event-utils";
import { Calendar, MapPin, Video, Users, Flag, Star, ImagePlus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/events/$id/")({
  component: EventDetail,
});

function EventDetail() {
  const { id } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [event, setEvent] = useState<any>(null);
  const [host, setHost] = useState<any>(null);
  const [myRsvp, setMyRsvp] = useState<any>(null);
  const [counts, setCounts] = useState({ going: 0, waitlisted: 0 });
  const [myRole, setMyRole] = useState<"host" | "checker" | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportPhotoId, setReportPhotoId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data: ev } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
    setEvent(ev);
    if (ev) {
      const { data: h } = await supabase.from("hosts").select("*").eq("id", ev.host_id).maybeSingle();
      setHost(h);
      const { data: rs } = await supabase.from("rsvps").select("status").eq("event_id", id);
      const going = (rs || []).filter((r) => r.status === "going").length;
      const wait = (rs || []).filter((r) => r.status === "waitlisted").length;
      setCounts({ going, waitlisted: wait });
      const { data: ph } = await supabase.from("photos").select("*").eq("event_id", id).eq("approved", true).order("created_at", { ascending: false });
      setPhotos(ph || []);
      if (user) {
        const { data: mr } = await supabase.from("rsvps").select("*").eq("event_id", id).eq("user_id", user.id).maybeSingle();
        setMyRsvp(mr);
        const { data: hm } = await supabase.from("host_members").select("role").eq("host_id", ev.host_id).eq("user_id", user.id).maybeSingle();
        setMyRole((hm?.role as any) || null);
        const { data: fb } = await supabase.from("feedback").select("*").eq("event_id", id).eq("user_id", user.id).maybeSingle();
        setFeedback(fb);
      }
    }
    setLoading(false);
  }

  useEffect(() => { if (!authLoading) load(); }, [id, user, authLoading]);

  if (loading) return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-muted-foreground">Loading…</div>;
  if (!event) return <div className="mx-auto max-w-3xl px-4 py-16 text-center">Event not found.</div>;

  const past = isPast(event.end_at);
  const full = counts.going >= event.capacity;

  async function rsvp() {
    if (!user) { nav({ to: "/login", search: { redirect: `/events/${id}` } }); return; }
    const status = full ? "waitlisted" : "going";
    const { error } = await supabase.from("rsvps").insert({ event_id: id, user_id: user.id, status });
    if (error) { toast.error(error.message); return; }
    toast.success(status === "going" ? "You're going!" : "Added to waitlist");
    load();
  }

  async function cancel() {
    if (!myRsvp) return;
    const { error } = await supabase.from("rsvps").update({ status: "cancelled" }).eq("id", myRsvp.id);
    if (error) { toast.error(error.message); return; }
    toast.success("RSVP cancelled");
    load();
  }

  async function submitFeedback() {
    if (!user || rating < 1) return;
    const { error } = await supabase.from("feedback").insert({
      event_id: id, user_id: user.id, rating, comment: comment || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Thanks for your feedback!");
    setRating(0); setComment("");
    load();
  }

  async function uploadPhotos(files: FileList | null) {
    if (!files || !user) return;
    for (const file of Array.from(files)) {
      const path = `${user.id}/${id}/${Date.now()}-${file.name}`;
      const { error: up } = await supabase.storage.from("event-photos").upload(path, file);
      if (up) { toast.error(up.message); continue; }
      const { data: pub } = supabase.storage.from("event-photos").getPublicUrl(path);
      await supabase.from("photos").insert({ event_id: id, user_id: user.id, image_url: pub.publicUrl });
    }
    toast.success("Photos uploaded for review");
    load();
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="aspect-[21/9] w-full overflow-hidden bg-muted">
          {event.cover_image_url ? (
            <img src={event.cover_image_url} alt={event.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-accent">
              <Calendar className="h-12 w-12 text-primary/60" />
            </div>
          )}
        </div>
        <div className="p-6 sm:p-8">
          {past && <Badge variant="secondary" className="mb-3">Ended</Badge>}
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-3xl font-bold sm:text-4xl">{event.title}</h1>
            <Button variant="ghost" size="sm" onClick={() => { setReportPhotoId(null); setReportOpen(true); }}>
              <Flag className="mr-1 h-4 w-4" />Report
            </Button>
          </div>
          <p className="mt-2 text-muted-foreground">
            by <Link to="/hosts/$id" params={{ id: event.host_id }} className="text-foreground underline">{host?.display_name}</Link>
          </p>

          <div className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" />{fmtDate(event.start_at)} → {fmtDate(event.end_at)}</div>
            <div className="flex items-center gap-2">
              {event.online_link ? <Video className="h-4 w-4 text-primary" /> : <MapPin className="h-4 w-4 text-primary" />}
              {event.online_link || event.venue_address || "TBA"}
            </div>
            <div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" />{counts.going} / {event.capacity} going{counts.waitlisted > 0 && ` · ${counts.waitlisted} waitlisted`}</div>
            <div className="flex items-center gap-2"><Badge variant="outline">Free event</Badge></div>
          </div>

          <div className="mt-6 whitespace-pre-wrap text-foreground/90">{event.description}</div>

          <div className="mt-8 flex flex-wrap gap-3 border-t pt-6">
            {!user && !past && (
              <Button asChild><Link to="/login" search={{ redirect: `/events/${id}` }}>Sign in to RSVP</Link></Button>
            )}
            {myRole === "host" && (
              <>
                <Button asChild><Link to="/events/$id/edit" params={{ id }}>Manage event</Link></Button>
                <Button variant="secondary" asChild><Link to="/events/$id/check-in" params={{ id }}>Open check-in</Link></Button>
              </>
            )}
            {myRole === "checker" && (
              <Button variant="secondary" asChild><Link to="/events/$id/check-in" params={{ id }}>Open check-in</Link></Button>
            )}
            {past && !myRole && <Badge variant="secondary">This event has ended</Badge>}
            {!past && user && !myRole && !myRsvp && (
              <Button onClick={rsvp}>{full ? "Join waitlist" : "RSVP — Free"}</Button>
            )}
            {!past && myRsvp?.status === "going" && (
              <>
                <Button variant="outline" onClick={() => downloadICS({
                  title: event.title, description: event.description,
                  location: event.online_link || event.venue_address || "",
                  start: event.start_at, end: event.end_at,
                })}>Add to calendar</Button>
                <Button variant="ghost" onClick={cancel}>Cancel RSVP</Button>
              </>
            )}
            {!past && myRsvp?.status === "waitlisted" && (
              <>
                <Badge variant="secondary">On waitlist</Badge>
                <Button variant="ghost" onClick={cancel}>Leave waitlist</Button>
              </>
            )}
          </div>

          {myRsvp?.status === "going" && myRsvp.ticket_code && (
            <div className="mt-6">
              <TicketCard event={event} ticketCode={myRsvp.ticket_code} />
            </div>
          )}
        </div>
      </div>

      {past && myRsvp?.status === "going" && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border bg-card p-5">
            <h3 className="font-semibold">Leave feedback</h3>
            {feedback ? (
              <div className="mt-3 text-sm">
                <div className="flex gap-1">{Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`h-4 w-4 ${i < feedback.rating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                ))}</div>
                {feedback.comment && <p className="mt-2 text-muted-foreground">{feedback.comment}</p>}
              </div>
            ) : (
              <>
                <div className="mt-2 flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => setRating(n)}>
                      <Star className={`h-6 w-6 ${n <= rating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                    </button>
                  ))}
                </div>
                <Textarea className="mt-3" placeholder="Optional comment…" value={comment} onChange={(e) => setComment(e.target.value)} />
                <Button className="mt-3" onClick={submitFeedback} disabled={rating < 1}>Submit</Button>
              </>
            )}
          </div>
          <div className="rounded-xl border bg-card p-5">
            <h3 className="font-semibold">Upload photos</h3>
            <p className="mt-1 text-sm text-muted-foreground">Photos go up after host approval.</p>
            <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md bg-secondary px-3 py-2 text-sm">
              <ImagePlus className="h-4 w-4" />Choose photos
              <Input type="file" accept="image/*" multiple className="hidden" onChange={(e) => uploadPhotos(e.target.files)} />
            </label>
          </div>
        </div>
      )}

      {past && photos.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold">Photo gallery</h2>
          <div className="mt-4 grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
            {photos.map((p) => (
              <div key={p.id} className="group relative aspect-square overflow-hidden rounded-lg bg-muted">
                <img src={p.image_url} alt="event photo" className="h-full w-full object-cover" />
                <button
                  onClick={() => { setReportPhotoId(p.id); setReportOpen(true); }}
                  className="absolute right-2 top-2 hidden rounded bg-black/60 p-1 text-white group-hover:block"
                >
                  <Flag className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetType={reportPhotoId ? "photo" : "event"}
        targetId={reportPhotoId || id}
      />
    </div>
  );
}
