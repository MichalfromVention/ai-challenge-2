import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { EventCard } from "@/components/EventCard";

export const Route = createFileRoute("/explore")({
  head: () => ({ meta: [{ title: "Explore events — Gather" }] }),
  component: Explore,
});

function Explore() {
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [includePast, setIncludePast] = useState(false);
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      let qb = supabase
        .from("events")
        .select("id, title, cover_image_url, start_at, end_at, venue_address, online_link, host_id, hosts(display_name)")
        .eq("status", "published")
        .eq("visibility", "public")
        .order("start_at", { ascending: true });
      if (!includePast) qb = qb.gte("end_at", new Date().toISOString());
      if (from) qb = qb.gte("start_at", new Date(from).toISOString());
      if (to) qb = qb.lte("start_at", new Date(to).toISOString());
      if (q) qb = qb.ilike("title", `%${q}%`);
      const { data } = await qb;
      if (active) setEvents(data || []);
    })();
    return () => { active = false; };
  }, [q, from, to, includePast]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">Explore</h1>
      <p className="mt-1 text-muted-foreground">Free community gatherings near you.</p>

      <div className="mt-6 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_auto_auto_auto]">
        <Input placeholder="Search events…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <Switch checked={includePast} onCheckedChange={setIncludePast} />Include past
        </label>
      </div>

      {events.length === 0 ? (
        <div className="mt-12 rounded-xl border bg-card p-12 text-center text-muted-foreground">
          No events match your filters
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => <EventCard key={e.id} event={e} />)}
        </div>
      )}
    </div>
  );
}
