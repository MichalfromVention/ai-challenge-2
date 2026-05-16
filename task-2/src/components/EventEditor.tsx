import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

type Props = { eventId?: string };

export function EventEditor({ eventId }: Props) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [hosts, setHosts] = useState<any[]>([]);
  const [hostId, setHostId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [timezone, setTimezone] = useState("Europe/Warsaw");
  const [online, setOnline] = useState(false);
  const [venue, setVenue] = useState("");
  const [link, setLink] = useState("");
  const [capacity, setCapacity] = useState(50);
  const [visibility, setVisibility] = useState<"public" | "unlisted">("public");
  const [coverUrl, setCoverUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("host_members")
        .select("host_id, role, hosts(id, display_name)")
        .eq("user_id", user.id)
        .eq("role", "host");
      const list = (data || []).map((d: any) => d.hosts).filter(Boolean);
      setHosts(list);
      if (list.length === 1 && !eventId) setHostId(list[0].id);
    })();
  }, [user, eventId]);

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      const { data } = await supabase.from("events").select("*").eq("id", eventId).single();
      if (!data) return;
      setHostId(data.host_id);
      setTitle(data.title); setDescription(data.description);
      setStartAt(data.start_at?.slice(0, 16)); setEndAt(data.end_at?.slice(0, 16));
      setTimezone(data.timezone); setVenue(data.venue_address || "");
      setLink(data.online_link || ""); setOnline(!!data.online_link);
      setCapacity(data.capacity); setVisibility(data.visibility as "public" | "unlisted");
      setCoverUrl(data.cover_image_url || "");
    })();
  }, [eventId]);

  async function uploadCover(file: File) {
    if (!user) return;
    setUploading(true);
    const path = `${user.id}/covers/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("cover-images").upload(path, file);
    if (error) { setUploading(false); toast.error(error.message); return; }
    const { data } = supabase.storage.from("cover-images").getPublicUrl(path);
    setCoverUrl(data.publicUrl);
    setUploading(false);
  }

  async function save(status: "draft" | "published") {
    if (!hostId || !title || !startAt || !endAt) {
      toast.error("Fill required fields");
      return;
    }
    setSaving(true);
    const payload = {
      host_id: hostId, title, description,
      start_at: new Date(startAt).toISOString(),
      end_at: new Date(endAt).toISOString(),
      timezone,
      venue_address: online ? null : venue || null,
      online_link: online ? link || null : null,
      capacity, visibility, status,
      cover_image_url: coverUrl || null,
      is_paid: false,
    };
    if (eventId) {
      const { error } = await supabase.from("events").update(payload).eq("id", eventId);
      if (error) { setSaving(false); toast.error(error.message); return; }
      toast.success(status === "published" ? "Published" : "Saved");
      nav({ to: "/events/$id", params: { id: eventId } });
    } else {
      const { data, error } = await supabase.from("events").insert(payload).select("id").single();
      if (error) { setSaving(false); toast.error(error.message); return; }
      toast.success(status === "published" ? "Published" : "Draft saved");
      nav({ to: "/events/$id", params: { id: data.id } });
    }
  }

  if (!user) return <div className="p-12 text-center">Please sign in.</div>;
  if (hosts.length === 0 && !eventId) return (
    <div className="mx-auto max-w-md p-12 text-center">
      <p className="text-muted-foreground">You need to be a host to create events.</p>
      <Button className="mt-4" onClick={() => nav({ to: "/dashboard" })}>Become a host</Button>
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-bold">{eventId ? "Edit event" : "Create event"}</h1>
      <div className="mt-6 space-y-5">
        {hosts.length > 1 && (
          <div>
            <Label>Host</Label>
            <Select value={hostId} onValueChange={setHostId}>
              <SelectTrigger><SelectValue placeholder="Select host" /></SelectTrigger>
              <SelectContent>
                {hosts.map((h) => <SelectItem key={h.id} value={h.id}>{h.display_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div><Label>Title *</Label><Input maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div><Label>Description</Label><Textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label>Starts *</Label><Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} /></div>
          <div><Label>Ends *</Label><Input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} /></div>
        </div>
        <div><Label>Timezone</Label><Input value={timezone} onChange={(e) => setTimezone(e.target.value)} /></div>
        <div className="flex items-center gap-3">
          <Switch checked={online} onCheckedChange={setOnline} />
          <Label>{online ? "Online event" : "In-person event"}</Label>
        </div>
        {online ? (
          <div><Label>Online link</Label><Input type="url" placeholder="https://…" value={link} onChange={(e) => setLink(e.target.value)} /></div>
        ) : (
          <div><Label>Venue address</Label><Input value={venue} onChange={(e) => setVenue(e.target.value)} /></div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label>Capacity</Label><Input type="number" min={1} value={capacity} onChange={(e) => setCapacity(parseInt(e.target.value) || 1)} /></div>
          <div>
            <Label>Visibility</Label>
            <Select value={visibility} onValueChange={(v: any) => setVisibility(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public — listed in Explore</SelectItem>
                <SelectItem value="unlisted">Unlisted — link only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Cover image</Label>
          <div className="mt-1 flex items-center gap-3">
            {coverUrl && <img src={coverUrl} alt="" className="h-16 w-28 rounded object-cover" />}
            <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadCover(e.target.files[0])} disabled={uploading} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="inline-flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm">
                  <Switch disabled checked={false} />Free / Paid
                </div>
              </TooltipTrigger>
              <TooltipContent>Coming soon</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex gap-3 border-t pt-6">
          <Button variant="outline" onClick={() => save("draft")} disabled={saving}>Save as draft</Button>
          <Button onClick={() => save("published")} disabled={saving}>Publish</Button>
        </div>
      </div>
    </div>
  );
}
