import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { InviteMembersDialog } from "@/components/InviteMembersDialog";
import { Pencil, Plus, UserPlus, EyeOff, Eye } from "lucide-react";
import { toast } from "sonner";
import { fmtDate, isPast, slugify, downloadCSV } from "@/lib/event-utils";

export const Route = createFileRoute("/dashboard")({ component: Dashboard });

function Dashboard() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [hosts, setHosts] = useState<any[]>([]);
  const [activeHost, setActiveHost] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<any[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [hName, setHName] = useState(""); const [hBio, setHBio] = useState(""); const [hEmail, setHEmail] = useState("");
  const [stats, setStats] = useState<Record<string, { going: number; waitlisted: number; checked: number }>>({});

  async function load() {
    if (!user) return;
    const { data } = await supabase.from("host_members").select("role, hosts(*)").eq("user_id", user.id);
    const list = (data || []).map((d: any) => d.hosts).filter(Boolean);
    setHosts(list);
    setActiveHost((cur: any) => cur || list[0] || null);
  }

  useEffect(() => { if (!loading) load(); }, [user, loading]);

  useEffect(() => {
    if (!activeHost) return;
    (async () => {
      const { data: ev } = await supabase.from("events").select("*").eq("host_id", activeHost.id).order("start_at", { ascending: false });
      setEvents(ev || []);
      const ids = (ev || []).map((e: any) => e.id);
      if (ids.length > 0) {
        const { data: rs } = await supabase.from("rsvps").select("event_id, status, checked_in_at").in("event_id", ids);
        const s: any = {};
        ids.forEach((id) => s[id] = { going: 0, waitlisted: 0, checked: 0 });
        (rs || []).forEach((r: any) => {
          if (r.status === "going") s[r.event_id].going++;
          if (r.status === "waitlisted") s[r.event_id].waitlisted++;
          if (r.checked_in_at) s[r.event_id].checked++;
        });
        setStats(s);
      }
      const { data: rep } = await supabase.from("reports").select("*").eq("hidden", false).order("created_at", { ascending: false });
      setReports(rep || []);
      const { data: ph } = await supabase.from("photos").select("*").in("event_id", ids).eq("approved", false);
      setPendingPhotos(ph || []);
    })();
  }, [activeHost]);

  async function createHost() {
    if (!hName) return;
    setCreating(true);
    const { data, error } = await supabase.rpc("become_host", { _display_name: hName, _bio: hBio, _contact_email: hEmail });
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    toast.success("You're a host now!");
    setHName(""); setHBio(""); setHEmail("");
    await load();
    if (data) {
      const { data: h } = await supabase.from("hosts").select("*").eq("id", data).single();
      if (h) setActiveHost(h);
    }
  }

  async function togglePublish(ev: any) {
    const next = ev.status === "published" ? "draft" : "published";
    await supabase.from("events").update({ status: next }).eq("id", ev.id);
    setEvents((cur) => cur.map((e) => e.id === ev.id ? { ...e, status: next } : e));
  }
  async function duplicate(ev: any) {
    const { data } = await supabase.from("events").insert({
      host_id: ev.host_id, title: ev.title + " (copy)", description: ev.description,
      start_at: ev.start_at, end_at: ev.end_at, timezone: ev.timezone,
      venue_address: ev.venue_address, online_link: ev.online_link,
      capacity: ev.capacity, cover_image_url: ev.cover_image_url,
      visibility: ev.visibility, status: "draft",
    }).select("id").single();
    if (data) nav({ to: "/events/$id/edit", params: { id: data.id } });
  }
  async function exportCsv(ev: any) {
    const { data, error } = await supabase.rpc("export_event_rsvps", { _event_id: ev.id });
    if (error) { toast.error(error.message); return; }
    const date = new Date().toISOString().slice(0, 10);
    downloadCSV(`${slugify(ev.title)}-rsvps-${date}.csv`, (data || []) as any[]);
  }
  async function approvePhoto(p: any, approved: boolean) {
    if (approved) await supabase.from("photos").update({ approved: true }).eq("id", p.id);
    else await supabase.from("photos").delete().eq("id", p.id);
    setPendingPhotos((cur) => cur.filter((x) => x.id !== p.id));
  }
  async function actionReport(r: any, hide: boolean) {
    await supabase.from("reports").update({ hidden: true }).eq("id", r.id);
    if (hide && r.target_type === "event") await supabase.from("events").update({ status: "draft" }).eq("id", r.target_id);
    if (hide && r.target_type === "photo") await supabase.from("photos").update({ approved: false }).eq("id", r.target_id);
    setReports((cur) => cur.filter((x) => x.id !== r.id));
  }

  if (loading) return <div className="p-12 text-center text-muted-foreground">Loading…</div>;
  if (!user) return (
    <div className="mx-auto max-w-md p-12 text-center">
      <p>Please sign in to access the host dashboard.</p>
      <Button className="mt-4" asChild><Link to="/login" search={{ redirect: "/dashboard" }}>Sign in</Link></Button>
    </div>
  );

  if (hosts.length === 0) return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="text-3xl font-bold">Become a host</h1>
      <p className="mt-2 text-muted-foreground">Create a host profile to publish events.</p>
      <div className="mt-6 space-y-4">
        <div><Label>Host name *</Label><Input value={hName} onChange={(e) => setHName(e.target.value)} /></div>
        <div><Label>Bio</Label><Textarea value={hBio} onChange={(e) => setHBio(e.target.value)} rows={3} /></div>
        <div><Label>Contact email</Label><Input type="email" value={hEmail} onChange={(e) => setHEmail(e.target.value)} /></div>
        <Button onClick={createHost} disabled={creating || !hName}>Create host</Button>
      </div>
    </div>
  );

  const upcoming = events.filter((e) => !isPast(e.end_at));
  const past = events.filter((e) => isPast(e.end_at));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Host dashboard</h1>
          {hosts.length > 1 ? (
            <select value={activeHost?.id} onChange={(e) => setActiveHost(hosts.find(h => h.id === e.target.value))} className="mt-1 rounded border bg-background px-2 py-1 text-sm">
              {hosts.map((h) => <option key={h.id} value={h.id}>{h.display_name}</option>)}
            </select>
          ) : (
            <p className="text-muted-foreground">{activeHost?.display_name}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setInviteOpen(true)}><UserPlus className="mr-1 h-4 w-4" />Invite members</Button>
          <Button variant="outline" asChild><Link to="/hosts/$id/edit" params={{ id: activeHost.id }}><Pencil className="mr-1 h-4 w-4" />Edit host</Link></Button>
          <Button asChild><Link to="/events/new"><Plus className="mr-1 h-4 w-4" />Create event</Link></Button>
        </div>
      </div>

      <Section title="Upcoming events" items={upcoming} stats={stats} togglePublish={togglePublish} duplicate={duplicate} exportCsv={exportCsv} />
      <Section title="Past events" items={past} stats={stats} togglePublish={togglePublish} duplicate={duplicate} exportCsv={exportCsv} />

      {pendingPhotos.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Pending photo approvals</h2>
          <div className="mt-3 grid gap-3 grid-cols-2 sm:grid-cols-4">
            {pendingPhotos.map((p) => (
              <div key={p.id} className="overflow-hidden rounded-lg border">
                <img src={p.image_url} alt="" className="aspect-square w-full object-cover" />
                <div className="flex gap-1 p-2">
                  <Button size="sm" className="flex-1" onClick={() => approvePhoto(p, true)}>Approve</Button>
                  <Button size="sm" variant="ghost" className="flex-1" onClick={() => approvePhoto(p, false)}>Reject</Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {reports.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Reports</h2>
          <ul className="mt-3 space-y-2">
            {reports.map((r) => (
              <li key={r.id} className="rounded-md border bg-card p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><Badge>{r.target_type}</Badge> <span className="text-muted-foreground">{r.reason || "no reason"}</span></div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => actionReport(r, true)}>Hide</Button>
                    <Button size="sm" variant="ghost" onClick={() => actionReport(r, false)}>Dismiss</Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {activeHost && (
        <InviteMembersDialog open={inviteOpen} onOpenChange={setInviteOpen} hostId={activeHost.id} />
      )}
    </div>
  );
}

function Section({ title, items, stats, togglePublish, duplicate, exportCsv }: any) {
  if (items.length === 0) return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">None yet.</p>
    </section>
  );
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold">{title}</h2>
      <ul className="mt-3 space-y-3">
        {items.map((e: any) => {
          const s = stats[e.id] || { going: 0, waitlisted: 0, checked: 0 };
          return (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{e.title}</h3>
                  <Badge variant={e.status === "published" ? "default" : "secondary"}>{e.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{fmtDate(e.start_at)} · {s.going} going · {s.waitlisted} waitlist · {s.checked} checked in</p>
              </div>
              <div className="flex flex-wrap gap-1">
                <Button size="sm" variant="ghost" asChild><Link to="/events/$id" params={{ id: e.id }}>View</Link></Button>
                <Button size="sm" variant="ghost" asChild><Link to="/events/$id/edit" params={{ id: e.id }}>Edit</Link></Button>
                <Button size="sm" variant="ghost" onClick={() => togglePublish(e)}>
                  {e.status === "published" ? <><EyeOff className="mr-1 h-3 w-3" />Unpublish</> : <><Eye className="mr-1 h-3 w-3" />Publish</>}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => duplicate(e)}>Duplicate</Button>
                <Button size="sm" variant="ghost" asChild><Link to="/events/$id/check-in" params={{ id: e.id }}>Check-in</Link></Button>
                <Button size="sm" variant="ghost" onClick={() => exportCsv(e)}>Export</Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
