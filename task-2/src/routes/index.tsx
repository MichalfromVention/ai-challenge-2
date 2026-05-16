import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, Users, Ticket } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gather — Free community events" },
      { name: "description", content: "Publish free community events, RSVP, and gather your people." },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-accent via-background to-background" />
        <div className="mx-auto max-w-5xl px-4 py-24 sm:py-32 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Free for hosts and attendees
          </div>
          <h1 className="mt-6 text-5xl font-bold tracking-tight sm:text-6xl">
            Gather your community
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
            Publish free events, send out tickets, check folks in at the door.
            No fees, no fluff — just gatherings that matter.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild>
              <Link to="/explore">Explore events <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/dashboard">Host an event</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { Icon: Calendar, title: "Publish in minutes", body: "Drafts, covers, public or unlisted — keep it simple." },
            { Icon: Ticket, title: "Free digital tickets", body: "QR codes, calendar files, waitlist auto-promotion." },
            { Icon: Users, title: "Door-friendly check-in", body: "Hosts and dedicated checkers, fast code entry." },
          ].map(({ Icon, title, body }) => (
            <div key={title} className="rounded-xl border bg-card p-6">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t py-10 text-center text-sm text-muted-foreground">
        <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Free for hosts and attendees
        </div>
        <div className="mt-3">© Gather</div>
      </footer>
    </div>
  );
}
