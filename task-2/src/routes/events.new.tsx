import { createFileRoute } from "@tanstack/react-router";
import { EventEditor } from "@/components/EventEditor";

export const Route = createFileRoute("/events/new")({
  component: () => <EventEditor />,
});
