import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function ReportDialog({
  open, onOpenChange, targetType, targetId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  targetType: "event" | "photo";
  targetId: string;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { toast.error("Please sign in to report"); setSubmitting(false); return; }
    const { error } = await supabase.from("reports").insert({
      target_type: targetType, target_id: targetId,
      reporter_user_id: u.user.id, reason: reason || null,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Reported. Thanks.");
    setReason("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report this {targetType}</DialogTitle>
        </DialogHeader>
        <Textarea
          placeholder="Tell us what's wrong (optional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>Submit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
