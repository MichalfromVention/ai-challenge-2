import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Mail } from "lucide-react";
import { EventCard } from "@/components/EventCard";

export const Route = createFileRoute("/hosts/$id/")({
  component: HostProfile,
});

function HostProfile() {
  const { id } = Route.useParams();
  const [host, setHost] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: h } = await supabase.from("hosts").select("*").eq("id", id).maybeSingle();
      setHost(h);
      const { data: e } = await supabase
        .from("events")
        .select("id, title, cover_image_url, start_at, end_at, venue_address, online_link")
        .eq("host_id", id)
        .eq("status", "published")
        .order("start_at", { ascending: false });
      setEvents(e || []);
    })();
  }, [id]);

  if (!host) return <div className="p-12 text-center text-muted-foreground">Loading…</div>;

  const initial = host.display_name?.[0]?.toUpperCase() || "H";
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center gap-4">
        {host.logo_url ? (
          <img src={host.logo_url} alt="" className="h-20 w-20 rounded-full object-cover" />
        ) : (
          <div className="grid h-20 w-20 place-items-center rounded-full bg-primary text-3xl font-bold text-primary-foreground">{initial}</div>
        )}
        <div>
          <h1 className="text-3xl font-bold">{host.display_name}</h1>
          {host.contact_email && (
            <a href={`mailto:${host.contact_email}`} className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <Mail className="h-3.5 w-3.5" />{host.contact_email}
            </a>
          )}
        </div>
      </div>
      {host.bio && <p className="mt-6 whitespace-pre-wrap text-foreground/90">{host.bio}</p>}

      <h2 className="mt-10 text-xl font-semibold">Events</h2>
      {events.length === 0 ? (
        <div className="mt-4 rounded-lg border bg-card p-8 text-center text-muted-foreground">
          <Calendar className="mx-auto h-8 w-8" />
          <p className="mt-2">No published events yet.</p>
        </div>
      ) : (
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => <EventCard key={e.id} event={e} />)}
        </div>
      )}
    </div>
  );
}
