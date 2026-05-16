import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/hosts/$id/edit")({
  component: HostEdit,
});

function HostEdit() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  const [logo, setLogo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: hm } = await supabase.from("host_members").select("role").eq("host_id", id).eq("user_id", user.id).eq("role", "host").maybeSingle();
      if (!hm) { setAllowed(false); return; }
      setAllowed(true);
      const { data: h } = await supabase.from("hosts").select("*").eq("id", id).single();
      if (h) { setName(h.display_name); setBio(h.bio); setEmail(h.contact_email); setLogo(h.logo_url || ""); }
    })();
  }, [id, user]);

  async function uploadLogo(file: File) {
    if (!user) return;
    const path = `${user.id}/logos/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("host-logos").upload(path, file);
    if (error) { toast.error(error.message); return; }
    const { data } = supabase.storage.from("host-logos").getPublicUrl(path);
    setLogo(data.publicUrl);
  }

  async function save() {
    setSaving(true);
    const { error } = await supabase.from("hosts").update({
      display_name: name, bio, contact_email: email, logo_url: logo || null,
    }).eq("id", id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    nav({ to: "/hosts/$id", params: { id } });
  }

  if (allowed === false) return <div className="p-12 text-center">Not allowed.</div>;
  if (allowed === null) return <div className="p-12 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-bold">Edit host profile</h1>
      <div className="mt-6 space-y-4">
        <div><Label>Host name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div>
          <Label>Logo</Label>
          <div className="mt-1 flex items-center gap-3">
            {logo && <img src={logo} alt="" className="h-12 w-12 rounded-full object-cover" />}
            <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
          </div>
        </div>
        <div><Label>Bio</Label><Textarea rows={4} value={bio} onChange={(e) => setBio(e.target.value)} /></div>
        <div><Label>Contact email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <Button onClick={save} disabled={saving}>Save changes</Button>
      </div>
    </div>
  );
}
