import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, LogOut } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { ThemeToggle } from "@/components/afterclass/theme";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { meQuery } from "@/lib/afterclass";

const primaryLinks = [
  { to: "/discover", label: "Discover" },
  { to: "/matches", label: "Matches" },
  { to: "/profile", label: "Profile" },
] as const;

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      to="/"
      className="inline-flex items-center gap-2.5 text-foreground"
      aria-label="AFTERCLASS home"
    >
      <span className="grid size-8 place-items-center border border-primary/60 text-xs font-semibold text-primary">
        A
      </span>
      <span className={compact ? "sr-only" : "font-display text-sm font-bold tracking-[0.12em]"}>
        AFTERCLASS
      </span>
    </Link>
  );
}

function useSignedIn() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => data.subscription.unsubscribe();
  }, []);
  return signedIn;
}

export function SiteHeader() {
  const signedIn = useSignedIn();
  const { data: me } = useQuery({ ...meQuery, enabled: signedIn });
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const links = signedIn
    ? [...primaryLinks, ...(me?.isAdmin ? [{ to: "/admin", label: "Admin" } as const] : [])]
    : [];

  return (
    <header className="relative z-10 border-b border-border bg-background">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-5 px-5 md:px-8">
        <BrandMark />
        <nav aria-label="Main navigation" className="hidden items-center gap-7 md:flex">
          {links.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              {item.label}
            </Link>
          ))}
          <Link
            to="/safety"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Safety
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {signedIn ? (
            <Button size="sm" variant="outline" onClick={signOut}>
              Sign out <LogOut aria-hidden="true" />
            </Button>
          ) : (
            <Button asChild size="sm" variant="outline">
              <Link to="/auth">
                Sign in <ArrowUpRight aria-hidden="true" />
              </Link>
            </Button>
          )}
        </div>
      </div>
      {links.length > 0 && (
        <nav
          aria-label="Mobile navigation"
          className="flex gap-6 overflow-x-auto border-t border-border px-5 py-3 md:hidden"
        >
          {links.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="shrink-0 text-xs text-muted-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-8 md:flex-row md:items-center md:justify-between md:px-8">
        <div className="flex items-center gap-4">
          <BrandMark compact />
          <p className="text-xs text-muted-foreground">An independent student-focused project.</p>
        </div>
        <nav
          aria-label="Footer navigation"
          className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground"
        >
          <Link to="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link to="/guidelines" className="hover:text-foreground">
            Community guidelines
          </Link>
          <Link to="/safety" className="hover:text-foreground">
            Safety
          </Link>
          <Link to="/contact" className="hover:text-foreground">
            Contact
          </Link>
        </nav>
        <span className="text-xs text-muted-foreground">
          Not operated by or affiliated with Adamas University.
        </span>
      </div>
    </footer>
  );
}

export function SiteFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
        {eyebrow}
      </p>
      <h1 className="font-display text-4xl font-semibold leading-tight text-foreground md:text-5xl">
        {title}
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">{description}</p>
    </div>
  );
}

export function ContentSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-border py-7">
      <h2 className="font-display text-xl font-semibold text-foreground">{title}</h2>
      <div className="mt-4 text-sm leading-7 text-muted-foreground">{children}</div>
    </section>
  );
}

export function Gate({ children }: { children: ReactNode }) {
  const { data: me, isLoading, isError, refetch } = useQuery(meQuery);
  if (isLoading)
    return (
      <p className="mx-auto max-w-7xl px-5 py-14 text-sm text-muted-foreground md:px-8">Loading…</p>
    );
  if (isError) {
    return (
      <main className="mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-20">
        <PageHeading
          eyebrow="Something went wrong"
          title="We couldn’t load your account."
          description="Check your connection and try again. If this keeps happening, sign out and back in."
        />
        <div className="mt-8 flex gap-3">
          <Button onClick={() => refetch()}>Try again</Button>
          <Button asChild variant="outline">
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>
      </main>
    );
  }
  if (!me) {
    return (
      <main className="mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-20">
        <PageHeading
          eyebrow="Signed out"
          title="Please sign in again."
          description="Your session has ended."
        />
        <Button asChild className="mt-8">
          <Link to="/auth">Sign in</Link>
        </Button>
      </main>
    );
  }
  if (me.isAdmin) return <>{children}</>;
  if (!me.approved) {
    const v = me.verification;
    const title = !me.profile?.onboarded
      ? "Finish your profile first."
      : !v
        ? "Upload your college ID."
        : v.status === "rejected"
          ? "Your ID wasn’t approved."
          : "Your ID is being reviewed.";
    const text =
      v?.status === "rejected"
        ? v.note || "Please upload a clearer photo of your college ID."
        : !v || !me.profile?.onboarded
          ? "Discovery and messaging open once your profile is complete and a moderator approves your college ID."
          : "A moderator will check it shortly. You’ll be able to meet people as soon as you’re approved.";
    return (
      <main className="mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-20">
        <PageHeading eyebrow="Almost there" title={title} description={text} />
        <Button asChild className="mt-8">
          <Link to="/profile">Go to my profile</Link>
        </Button>
      </main>
    );
  }
  return <>{children}</>;
}
