import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeading, SiteFrame } from "@/components/afterclass/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { isStudentEmail, STUDENT_DOMAIN } from "@/lib/afterclass";
import { pageMetadata } from "@/lib/page-metadata";

export const Route = createFileRoute("/auth")({
  head: () => pageMetadata("Sign in", "Sign in or join AFTERCLASS with your Adamas student email."),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"in" | "up" | "forgot">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [sent, setSent] = useState<{ kind: "signup" | "reset"; message: string } | null>(null);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isStudentEmail(email)) {
      toast.error(`Use your student email ending in ${STUDENT_DOMAIN}`);
      return;
    }
    setBusy(true);
    try {
      if (mode === "up") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/profile` },
        });
        if (error) throw error;
        setSent({
          kind: "signup",
          message: "We sent a confirmation link to your student email. Open it to continue.",
        });
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSent({
          kind: "reset",
          message: "Check your inbox for a password reset link.",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        navigate({ to: "/discover" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (!isStudentEmail(email)) {
      toast.error(`Use your student email ending in ${STUDENT_DOMAIN}`);
      return;
    }
    setResendBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/profile` },
      });
      if (error) throw error;
      toast.success("Confirmation email sent again.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not resend the email");
    } finally {
      setResendBusy(false);
    }
  }

  return (
    <SiteFrame>
      <main className="mx-auto max-w-xl px-5 py-14 md:py-20">
        <PageHeading
          eyebrow="Students only"
          title={
            mode === "up"
              ? "Join AFTERCLASS."
              : mode === "forgot"
                ? "Reset your password."
                : "Welcome back."
          }
          description={`Use your ${STUDENT_DOMAIN} email. Never use your university portal password here — pick a new one.`}
        />
        {sent ? (
          <div className="mt-8 border border-primary/30 bg-primary/5 p-4 text-sm text-foreground">
            <p>{sent.message}</p>
            {sent.kind === "signup" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                disabled={resendBusy}
                onClick={resend}
              >
                {resendBusy ? "Sending…" : "Resend confirmation email"}
              </Button>
            )}
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Student email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={`yourname${STUDENT_DOMAIN}`}
              />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy
                ? "Please wait…"
                : mode === "up"
                  ? "Create account"
                  : mode === "forgot"
                    ? "Send reset link"
                    : "Sign in"}
            </Button>
          </form>
        )}
        <div className="mt-6 flex flex-wrap gap-4 text-sm text-muted-foreground">
          {mode !== "in" && (
            <button
              className="underline underline-offset-4"
              onClick={() => {
                setMode("in");
                setSent(null);
              }}
            >
              I have an account
            </button>
          )}
          {mode !== "up" && (
            <button
              className="underline underline-offset-4"
              onClick={() => {
                setMode("up");
                setSent(null);
              }}
            >
              Create an account
            </button>
          )}
          {mode === "in" && (
            <button className="underline underline-offset-4" onClick={() => setMode("forgot")}>
              Forgot password?
            </button>
          )}
        </div>
      </main>
    </SiteFrame>
  );
}
