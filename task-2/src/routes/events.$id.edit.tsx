import { createFileRoute } from "@tanstack/react-router";
import { EventEditor } from "@/components/EventEditor";

export const Route = createFileRoute("/events/$id/edit")({
  component: function EditEvent() {
    const { id } = Route.useParams();
    return <EventEditor eventId={id} />;
  },
});
