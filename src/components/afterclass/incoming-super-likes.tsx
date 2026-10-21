import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ageFrom, matchesQueryKey, signedUrls } from "@/lib/afterclass";

type IncomingSuperLike = {
  id: string;
  sender_id: string;
  message: string;
  created_at: string;
  profile: {
    id: string;
    display_name: string | null;
    birthdate: string | null;
    course: string | null;
    year: string | null;
    photo_path: string | null;
  };
  photo?: string | undefined;
};

const incomingKey = ["incoming-super-likes"];

export function IncomingSuperLikes({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [...incomingKey, userId],
    queryFn: async () => {
      const { data: likes, error } = await supabase
        .from("super_likes")
        .select("id, sender_id, message, created_at")
        .eq("target_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!likes?.length) return [] as IncomingSuperLike[];

      const senderIds = [...new Set(likes.map((like) => like.sender_id))];
      const [profilesResult, swipesResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name, birthdate, course, year, photo_path")
          .in("id", senderIds),
        supabase
          .from("swipes")
          .select("target, liked, created_at")
          .eq("swiper", userId)
          .in("target", senderIds),
      ]);
      if (profilesResult.error) throw profilesResult.error;
      if (swipesResult.error) throw swipesResult.error;

      const swipes = new Map((swipesResult.data ?? []).map((swipe) => [swipe.target, swipe]));
      const profiles = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]));
      const urls = await signedUrls(
        "photos",
        (profilesResult.data ?? []).map((profile) => profile.photo_path),
      );

      return likes.flatMap((like): IncomingSuperLike[] => {
        const swipe = swipes.get(like.sender_id);
        // Hide if they liked, or if they passed after this super like arrived.
        // A pass from before the super like still gets a chance to change.
        if (
          swipe &&
          (swipe.liked ||
            new Date(swipe.created_at).getTime() >= new Date(like.created_at).getTime())
        ) {
          return [];
        }
        const profile = profiles.get(like.sender_id);
        if (!profile) return [];
        return [
          {
            ...like,
            profile,
            photo: profile.photo_path ? urls[profile.photo_path] : undefined,
          },
        ];
      });
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`incoming-super-likes-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "super_likes" }, () =>
        qc.invalidateQueries({ queryKey: incomingKey }),
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "swipes",
          filter: `swiper=eq.${userId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: incomingKey });
          qc.invalidateQueries({ queryKey: ["discover"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, userId]);

  async function respond(superLikeId: string, liked: boolean) {
    if (busyId) return;
    setBusyId(superLikeId);
    try {
      const { data: matchId, error } = await supabase.rpc("respond_to_super_like", {
        _super_like_id: superLikeId,
        _liked: liked,
      });
      if (error) throw error;
      if (!liked) toast.success("Passed");
      else if (matchId) toast.success("It’s a match! Say hello in Matches.");
      else toast.success("Like sent");
      qc.invalidateQueries({ queryKey: incomingKey });
      qc.invalidateQueries({ queryKey: matchesQueryKey });
      qc.invalidateQueries({ queryKey: ["discover"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not respond to that super like");
    } finally {
      setBusyId(null);
    }
  }

  if (isLoading) return null;
  if (isError) {
    return (
      <div className="mt-10 border border-border p-4">
        <p className="text-sm text-muted-foreground">Couldn’t load your super likes.</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  if (!data?.length) return null;

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Super likes for you ({data.length})
        </h2>
        <p className="text-xs text-muted-foreground">
          Someone spent their daily super like on you.
        </p>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {data.map((like) => (
          <article key={like.id} className="border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-3">
              <div className="size-14 shrink-0 overflow-hidden bg-secondary">
                {like.photo && (
                  <img
                    src={like.photo}
                    alt={like.profile.display_name ?? ""}
                    className="size-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-semibold text-foreground">
                  {like.profile.display_name}
                  {ageFrom(like.profile.birthdate) !== null &&
                    `, ${ageFrom(like.profile.birthdate)}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[like.profile.course, like.profile.year].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
            <blockquote className="mt-3 border-l-2 border-primary/50 pl-3 text-sm leading-6 text-foreground">
              {like.message}
            </blockquote>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={busyId === like.id}
                onClick={() => respond(like.id, true)}
              >
                Like back
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busyId === like.id}
                onClick={() => respond(like.id, false)}
              >
                Pass
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link to="/people/$userId" params={{ userId: like.sender_id }}>
                  View profile
                </Link>
              </Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
