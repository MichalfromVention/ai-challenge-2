import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2 } from "lucide-react";
import { fmtDate } from "@/lib/event-utils";

export function TicketCard({
  event, ticketCode,
}: {
  event: { title: string; start_at: string; venue_address: string | null; online_link: string | null };
  ticketCode: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex items-center gap-2 bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">
        <CheckCircle2 className="h-4 w-4" /> CONFIRMED
      </div>
      <div className="grid gap-6 p-6 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="space-y-1">
          <h3 className="text-xl font-semibold">{event.title}</h3>
          <p className="text-sm text-muted-foreground">{fmtDate(event.start_at)}</p>
          <p className="text-sm text-muted-foreground">{event.online_link ? "Online" : event.venue_address || "TBA"}</p>
          <div className="pt-3">
            <div className="text-xs uppercase text-muted-foreground">Ticket code</div>
            <div className="font-mono text-2xl font-bold tracking-widest">{ticketCode}</div>
          </div>
        </div>
        <div className="rounded-lg bg-white p-3">
          <QRCodeSVG value={ticketCode} size={128} />
        </div>
      </div>
    </div>
  );
}
