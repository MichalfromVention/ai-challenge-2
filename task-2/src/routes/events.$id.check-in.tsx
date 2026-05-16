import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/events/$id/check-in")({
  component: CheckIn,
});

function CheckIn() {
  const { id } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [event, setEvent] = useState<any>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [code, setCode] = useState("");
  const [counts, setCounts] = useState({ going: 0, checked: 0, waitlisted: 0 });
  const [recent, setRecent] = useState<any[]>([]);
  const [lastId, setLastId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const { data: rs } = await supabase
      .from("rsvps")
      .select("id, status, ticket_code, checked_in_at, user_id, profiles(display_name)")
      .eq("event_id", id);
    const list = rs || [];
    setCounts({
      going: list.filter((r: any) => r.status === "going").length,
      checked: list.filter((r: any) => r.checked_in_at).length,
      waitlisted: list.filter((r: any) => r.status === "waitlisted").length,
    });
    const checked = list
      .filter((r: any) => r.checked_in_at)
      .sort((a: any, b: any) => (b.checked_in_at || "").localeCompare(a.checked_in_at || ""))
      .slice(0, 5);
    setRecent(checked);
  }

  useEffect(() => {
    if (authLoading) return;
    (async () => {
      const { data: ev } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
      setEvent(ev);
      if (!ev || !user) { setAllowed(false); return; }
      const { data: hm } = await supabase.from("host_members")
        .select("role").eq("host_id", ev.host_id).eq("user_id", user.id).maybeSingle();
      setAllowed(!!hm);
      if (hm) refresh();
    })();
  }, [id, user, authLoading]);

  useEffect(() => {
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [id]);

  useEffect(() => { inputRef.current?.focus(); }, [allowed]);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const c = code.trim().toUpperCase();
    if (!c) return;
    const { data: r } = await supabase
      .from("rsvps")
      .select("id, checked_in_at, profiles(display_name)")
      .eq("event_id", id).eq("ticket_code", c).maybeSingle();
    if (!r) { toast.error("Code not found"); }
    else if (r.checked_in_at) { toast.warning(`Already checked in at ${new Date(r.checked_in_at).toLocaleTimeString()}`); }
    else {
      const { error } = await supabase.from("rsvps").update({ checked_in_at: new Date().toISOString() }).eq("id", r.id);
      if (error) toast.error(error.message);
      else {
        toast.success(`Checked in ${(r as any).profiles?.display_name || "guest"}`);
        setLastId(r.id);
        refresh();
      }
    }
    setCode(""); inputRef.current?.focus();
  }

  async function undo() {
    if (!lastId) return;
    await supabase.from("rsvps").update({ checked_in_at: null }).eq("id", lastId);
    setLastId(null);
    toast.success("Undid last check-in");
    refresh();
  }

  if (authLoading || allowed === null) return <div className="p-12 text-center text-muted-foreground">Loading…</div>;
  if (!allowed) return (
    <div className="mx-auto max-w-md p-12 text-center">
      <p className="text-muted-foreground">You don't have access to this check-in page.</p>
      <Button className="mt-4" onClick={() => nav({ to: "/" })}>Go home</Button>
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link to="/events/$id" params={{ id }} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" />Back to event
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{event?.title}</h1>

      <div className="mt-6 grid grid-cols-3 gap-3 text-center">
        {[
          { label: "Going", value: counts.going },
          { label: "Checked-in", value: counts.checked },
          { label: "Waitlist", value: counts.waitlisted },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4">
            <div className="text-3xl font-bold">{s.value}</div>
            <div className="text-xs uppercase text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="mt-6 flex gap-2">
        <Input
          ref={inputRef}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Enter ticket code"
          className="font-mono text-lg"
          autoFocus
        />
        <Button type="submit">Check in</Button>
      </form>

      <div className="mt-6 rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Recent check-ins</h3>
          {lastId && (
            <Button size="sm" variant="ghost" onClick={undo}><RotateCcw className="mr-1 h-3 w-3" />Undo last</Button>
          )}
        </div>
        {recent.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">None yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between border-t pt-2 first:border-0 first:pt-0">
                <span>{r.profiles?.display_name || "Guest"}</span>
                <span className="text-muted-foreground">{new Date(r.checked_in_at).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
