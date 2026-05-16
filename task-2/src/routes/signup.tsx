import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  validateSearch: (s: Record<string, unknown>) => ({ redirect: (s.redirect as string) || "" }),
  component: SignUp,
});

function SignUp() {
  const nav = useNavigate();
  const { redirect } = useSearch({ from: "/signup" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { display_name: name }, emailRedirectTo: window.location.origin },
    });
    if (error) { setLoading(false); toast.error(error.message); return; }
    // try sign in immediately (auto-confirm)
    await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    toast.success("Welcome!");
    nav({ to: redirect || "/explore" });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <Link to="/" className="mb-8 text-center text-lg font-semibold">Gather</Link>
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div><Label>Display name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label>Password</Label><Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <Button type="submit" className="w-full" disabled={loading}>{loading ? "Creating…" : "Sign up"}</Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account? <Link to="/login" search={{ redirect }} className="text-primary underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
