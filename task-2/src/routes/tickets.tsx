import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { TicketCard } from "@/components/TicketCard";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/tickets")({ component: Tickets });

function Tickets() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("rsvps")
        .select("id, ticket_code, status, events(id, title, start_at, end_at, venue_address, online_link)")
        .eq("user_id", user.id)
        .eq("status", "going")
        .order("created_at", { ascending: false });
      setItems(data || []);
    })();
  }, [user]);

  if (loading) return <div className="p-12 text-center text-muted-foreground">Loading…</div>;
  if (!user) return (
    <div className="mx-auto max-w-md p-12 text-center">
      <p>Please sign in to view your tickets.</p>
      <Button className="mt-4" asChild><Link to="/login" search={{ redirect: "/tickets" }}>Sign in</Link></Button>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">My tickets</h1>
      {items.length === 0 ? (
        <p className="mt-6 text-muted-foreground">No tickets yet. <Link to="/explore" className="text-primary underline">Explore events</Link>.</p>
      ) : (
        <div className="mt-6 space-y-5">
          {items.map((r) => r.events && (
            <TicketCard key={r.id} event={r.events as any} ticketCode={r.ticket_code} />
          ))}
        </div>
      )}
    </div>
  );
}
