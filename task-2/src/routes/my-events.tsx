import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { EventCard } from "@/components/EventCard";

export const Route = createFileRoute("/my-events")({ component: MyEvents });

function MyEvents() {
  const { user } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: hm } = await supabase.from("host_members").select("host_id").eq("user_id", user.id);
      const ids = (hm || []).map((m) => m.host_id);
      if (ids.length === 0) { setEvents([]); return; }
      const { data } = await supabase.from("events")
        .select("id, title, cover_image_url, start_at, end_at, venue_address, online_link, hosts(display_name)")
        .in("host_id", ids).order("start_at", { ascending: false });
      setEvents(data || []);
    })();
  }, [user]);
  if (!user) return <div className="p-12 text-center">Please sign in. <Link to="/login" search={{ redirect: "/my-events" }} className="text-primary underline">Sign in</Link></div>;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">My events</h1>
      {events.length === 0 ? (
        <p className="mt-6 text-muted-foreground">No events yet.</p>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => <EventCard key={e.id} event={e} />)}
        </div>
      )}
    </div>
  );
}
