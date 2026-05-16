import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Calendar, Ticket, LayoutDashboard, LogOut } from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const initial = user?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground">
            <Calendar className="h-4 w-4" />
          </span>
          Gather
        </Link>
        <nav className="hidden md:flex items-center gap-1">
          <Button variant="ghost" asChild><Link to="/explore">Explore</Link></Button>
          {user && <Button variant="ghost" asChild><Link to="/tickets">My tickets</Link></Button>}
          {user && <Button variant="ghost" asChild><Link to="/dashboard">Dashboard</Link></Button>}
        </nav>
        <div className="flex items-center gap-2">
          {!user ? (
            <>
              <Button variant="ghost" asChild><Link to="/login">Sign in</Link></Button>
              <Button asChild><Link to="/signup">Sign up</Link></Button>
            </>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-sm font-semibold">
                  {initial}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem asChild><Link to="/tickets"><Ticket className="mr-2 h-4 w-4" />My tickets</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/my-events"><Calendar className="mr-2 h-4 w-4" />My events</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/dashboard"><LayoutDashboard className="mr-2 h-4 w-4" />Host dashboard</Link></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={async () => { await signOut(); navigate({ to: "/" }); }}>
                  <LogOut className="mr-2 h-4 w-4" />Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
