import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/invite/$token")({ component: Redeem });

function Redeem() {
  const { token } = Route.useParams();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [status, setStatus] = useState<"idle" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) { nav({ to: "/login", search: { redirect: `/invite/${token}` } }); return; }
    (async () => {
      const { data, error } = await supabase.rpc("redeem_invite", { _token: token });
      if (error) { setStatus("err"); setMsg(error.message); return; }
      const row = (data as any[])?.[0];
      if (!row) { setStatus("err"); setMsg("Invalid invite"); return; }
      setStatus("ok");
      setMsg(row.already_member ? `You're already a ${row.role} for this host.` : `You joined as ${row.role}.`);
      toast.success("Invite redeemed");
      setTimeout(() => nav({ to: "/dashboard" }), 1500);
    })();
  }, [user, loading, token]);

  return (
    <div className="mx-auto max-w-md p-12 text-center">
      <h1 className="text-2xl font-bold">Invite</h1>
      <p className="mt-4 text-muted-foreground">{status === "idle" ? "Redeeming…" : msg}</p>
      {status === "err" && <Button className="mt-4" onClick={() => nav({ to: "/" })}>Go home</Button>}
    </div>
  );
}
