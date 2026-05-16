import { Link } from "@tanstack/react-router";
import { Calendar, MapPin, Video } from "lucide-react";
import { fmtDate, isPast } from "@/lib/event-utils";
import { Badge } from "@/components/ui/badge";

type Props = {
  event: {
    id: string;
    title: string;
    cover_image_url: string | null;
    start_at: string;
    end_at: string;
    venue_address: string | null;
    online_link: string | null;
    hosts?: { display_name: string } | null;
  };
};

export function EventCard({ event }: Props) {
  const past = isPast(event.end_at);
  return (
    <Link
      to="/events/$id"
      params={{ id: event.id }}
      className="group flex flex-col overflow-hidden rounded-xl border bg-card transition hover:shadow-lg"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-muted">
        {event.cover_image_url ? (
          <img src={event.cover_image_url} alt={event.title} className="h-full w-full object-cover transition group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-accent">
            <Calendar className="h-10 w-10 text-primary/60" />
          </div>
        )}
        {past && (
          <Badge variant="secondary" className="absolute left-3 top-3">Ended</Badge>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-primary">
          {fmtDate(event.start_at)}
        </div>
        <h3 className="line-clamp-2 font-semibold leading-tight">{event.title}</h3>
        <div className="mt-auto flex items-center gap-2 pt-2 text-xs text-muted-foreground">
          {event.online_link ? <Video className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
          <span className="line-clamp-1">
            {event.online_link ? "Online" : event.venue_address || "TBA"}
          </span>
          {event.hosts && <span>· {event.hosts.display_name}</span>}
        </div>
      </div>
    </Link>
  );
}
