import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { IncomingSuperLikes } from "@/components/afterclass/incoming-super-likes";
import { Gate, PageHeading } from "@/components/afterclass/shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { matchesQueryKey, meQuery, signedUrls } from "@/lib/afterclass";

export const Route = createFileRoute("/_authenticated/matches")({
  head: () => ({
    meta: [
      { title: "Matches · AFTERCLASS" },
      { name: "description", content: "Your mutual matches." },
    ],
  }),
  component: () => (
    <Gate>
      <Matches />
    </Gate>
  ),
});

function relativeTime(value: string | null) {
  if (!value) return "";
  const then = new Date(value).getTime();
  const minutes = Math.floor((Date.now() - then) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function Matches() {
  const qc = useQueryClient();
  const { data: me } = useQuery(meQuery);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: matchesQueryKey,
    enabled: !!me,
    queryFn: async () => {
      const { data: matches, error } = await supabase.rpc("match_overview");
      if (error) throw error;
      const urls = await signedUrls(
        "photos",
        (matches ?? []).map((m) => m.photo_path),
      );
      return (matches ?? []).map((m) => ({
        ...m,
        photo: m.photo_path ? urls[m.photo_path] : undefined,
      }));
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("matches-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () =>
        qc.invalidateQueries({ queryKey: matchesQueryKey }),
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () =>
        qc.invalidateQueries({ queryKey: matchesQueryKey }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return (
    <main className="mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-20">
      <PageHeading
        eyebrow="Mutual, by design"
        title="Your matches."
        description="You both said yes. Open a chat to say hello."
      />
      {me && <IncomingSuperLikes userId={me.user.id} />}
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {isError && (
          <div className="sm:col-span-2 lg:col-span-4">
            <p className="text-sm text-muted-foreground">We couldn’t load your matches.</p>
            <Button variant="outline" className="mt-3" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        )}
        {!isLoading && !isError && data?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No matches yet — keep exploring{" "}
            <Link to="/discover" className="underline">
              Discover
            </Link>
            .
          </p>
        )}
        {data?.map((m) => (
          <Link
            key={m.match_id}
            to="/messages/$matchId"
            params={{ matchId: m.match_id }}
            className="group border border-border bg-card"
          >
            <div className="aspect-square overflow-hidden bg-secondary">
              {m.photo && (
                <img
                  src={m.photo}
                  alt={m.display_name ?? ""}
                  className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                />
              )}
            </div>
            <div className="p-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-display text-lg font-semibold text-foreground">
                  {m.display_name}
                </p>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {relativeTime(m.last_message_at)}
                </span>
              </div>
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                {m.last_message ?? m.course}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
