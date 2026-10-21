import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ProfileCard } from "@/components/afterclass/profile-card";
import { Gate, PageHeading } from "@/components/afterclass/shell";
import { SuperLikeButton } from "@/components/afterclass/super-like";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { matchesQueryKey, meQuery, signedUrls } from "@/lib/afterclass";
import { readPrompts } from "@/lib/profile-extras";

export const Route = createFileRoute("/_authenticated/discover")({
  head: () => ({
    meta: [
      { title: "Discover · AFTERCLASS" },
      { name: "description", content: "Meet verified Adamas students." },
    ],
  }),
  component: () => (
    <Gate>
      <Discover />
    </Gate>
  ),
});

function Discover() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const { data: me } = useQuery(meQuery);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["discover"],
    enabled: !!me,
    queryFn: async () => {
      const { data: profiles, error } = await supabase.rpc("discover_profiles", { _limit: 50 });
      if (error) throw error;
      const urls = await signedUrls(
        "photos",
        (profiles ?? []).flatMap((p) => p.photo_paths ?? []),
      );
      return (profiles ?? []).map((p) => ({
        ...p,
        photos: (p.photo_paths ?? []).flatMap((path) => (urls[path] ? [urls[path]] : [])),
        prompts: readPrompts(p.prompts),
      }));
    },
  });

  function removeProfile(target: string) {
    qc.setQueryData(["discover"], (old: typeof data) => {
      const next = old?.filter((p) => p.id !== target);
      if (!next?.length) void qc.invalidateQueries({ queryKey: ["discover"] });
      return next;
    });
  }

  async function swipe(target: string, liked: boolean) {
    if (!me || busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("swipes").insert({ swiper: me.user.id, target, liked });
      if (error) throw error;

      removeProfile(target);
      qc.invalidateQueries({ queryKey: matchesQueryKey });
      qc.invalidateQueries({ queryKey: ["incoming-super-likes"] });

      if (liked) {
        const { data: match } = await supabase
          .from("matches")
          .select("id")
          .or(
            `and(user_a.eq.${me.user.id},user_b.eq.${target}),and(user_a.eq.${target},user_b.eq.${me.user.id})`,
          )
          .maybeSingle();
        if (match) toast.success("It’s a match! Say hello from your matches.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save that swipe");
    } finally {
      setBusy(false);
    }
  }

  const current = data?.[0];

  return (
    <main className="mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-20">
      <PageHeading
        eyebrow="Discover"
        title="Meet beyond the lecture hall."
        description="Every profile here is a verified, 18+ Adamas student. Likes stay private unless they’re mutual."
      />
      <div className="mt-10 max-w-md">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Finding people…</p>
        ) : isError ? (
          <div className="border border-border p-8 text-center">
            <p className="font-display text-lg text-foreground">We couldn’t load Discover.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Check your connection and try again.
            </p>
            <Button variant="outline" className="mt-5" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : !current ? (
          <div className="border border-border p-8 text-center">
            <p className="font-display text-lg text-foreground">You’re all caught up.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Check back later as more students join.
            </p>
            <Button asChild variant="outline" className="mt-5">
              <Link to="/matches">See matches</Link>
            </Button>
          </div>
        ) : (
          <>
            <ProfileCard
              key={current.id}
              photos={current.photos}
              name={current.display_name}
              birthdate={current.birthdate}
              course={current.course}
              year={current.year}
              bio={current.bio}
              interests={current.interests}
              prompts={current.prompts}
              actions={
                <>
                  <Button
                    variant="outline"
                    size="lg"
                    disabled={busy}
                    onClick={() => swipe(current.id, false)}
                  >
                    <X aria-hidden="true" /> Pass
                  </Button>
                  <Button size="lg" disabled={busy} onClick={() => swipe(current.id, true)}>
                    <Heart aria-hidden="true" /> Like
                  </Button>
                  <SuperLikeButton
                    senderId={me!.user.id}
                    targetId={current.id}
                    targetName={current.display_name}
                    onSent={() => removeProfile(current.id)}
                  />
                </>
              }
            />
            <div className="mt-3 text-center">
              <Button asChild variant="ghost" size="sm">
                <Link to="/people/$userId" params={{ userId: current.id }}>
                  View full profile
                </Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
