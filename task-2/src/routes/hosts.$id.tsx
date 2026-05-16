import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/hosts/$id")({
  component: () => <Outlet />,
});
