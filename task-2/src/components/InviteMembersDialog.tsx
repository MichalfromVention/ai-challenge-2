import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Copy, Trash2, UserPlus, X } from "lucide-react";
import { randomToken } from "@/lib/event-utils";

type Member = { id: string; user_id: string; role: string; profiles?: { display_name: string } | null };
type Invite = { id: string; token: string; role: string; used_at: string | null; created_at: string };

export function InviteMembersDialog({
  open, onOpenChange, hostId,
}: { open: boolean; onOpenChange: (v: boolean) => void; hostId: string }) {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);

  async function load() {
    const { data: m } = await supabase
      .from("host_members")
      .select("id, user_id, role, profiles:profiles!host_members_user_id_fkey(display_name)")
      .eq("host_id", hostId);
    setMembers((m as any) || []);
    const { data: inv } = await supabase
      .from("host_invites")
      .select("*")
      .eq("host_id", hostId)
      .order("created_at", { ascending: false });
    setInvites((inv as any) || []);
  }

  useEffect(() => { if (open) load(); }, [open, hostId]);

  async function createInvite(role: "host" | "checker") {
    if (!user) return;
    const token = randomToken(40);
    const { error } = await supabase.from("host_invites").insert({
      host_id: hostId, role, token, created_by: user.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(`${role === "host" ? "Host" : "Checker"} invite created`);
    load();
  }

  async function deleteInvite(id: string) {
    await supabase.from("host_invites").delete().eq("id", id);
    load();
  }

  async function removeMember(id: string) {
    const { error } = await supabase.from("host_members").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Member removed"); load(); }
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    toast.success("Copied");
  }

  const inviteUrl = (token: string) =>
    typeof window !== "undefined" ? `${window.location.origin}/invite/${token}` : `/invite/${token}`;

  const iAmHost = members.find((m) => m.user_id === user?.id)?.role === "host";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" />Invite members</DialogTitle>
        </DialogHeader>

        <div>
          <div className="mb-2 text-sm font-medium">Current members</div>
          <ul className="space-y-2">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between rounded-md border p-2">
                <div className="flex items-center gap-2">
                  <span>{m.profiles?.display_name || m.user_id.slice(0, 8)}</span>
                  <Badge variant={m.role === "host" ? "default" : "secondary"}>{m.role}</Badge>
                </div>
                {iAmHost && m.user_id !== user?.id && (
                  <Button size="icon" variant="ghost" onClick={() => removeMember(m.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t pt-4">
          <div className="mb-2 text-sm font-medium">Generate invite link</div>
          <div className="flex gap-2">
            <Button onClick={() => createInvite("host")} className="flex-1">Invite as Host</Button>
            <Button onClick={() => createInvite("checker")} variant="secondary" className="flex-1">Invite as Checker</Button>
          </div>
        </div>

        {invites.length > 0 && (
          <div>
            <div className="mb-2 text-sm font-medium">Active invites</div>
            <ul className="space-y-2 max-h-60 overflow-y-auto">
              {invites.map((inv) => (
                <li key={inv.id} className="flex min-w-0 items-center gap-2 rounded-md border p-2">
                  <Badge variant={inv.role === "host" ? "default" : "secondary"} className="shrink-0">{inv.role}</Badge>
                  <code className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{inviteUrl(inv.token)}</code>
                  {inv.used_at && <Badge variant="outline" className="shrink-0">used</Badge>}
                  <Button size="icon" variant="ghost" className="shrink-0" onClick={() => copy(inviteUrl(inv.token))}><Copy className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="shrink-0" onClick={() => deleteInvite(inv.id)}><Trash2 className="h-4 w-4" /></Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
