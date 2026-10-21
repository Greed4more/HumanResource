import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { ProfileCard } from "@/components/afterclass/profile-card";
import { Gate, PageHeading } from "@/components/afterclass/shell";
import { SuperLikeButton } from "@/components/afterclass/super-like";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { meQuery, PROFILE_COLUMNS, signedUrls } from "@/lib/afterclass";
import { blockUser, submitReport } from "@/lib/moderation";
import { readPrompts } from "@/lib/profile-extras";

export const Route = createFileRoute("/_authenticated/people/$userId")({
  head: () => ({
    meta: [
      { title: "Profile · AFTERCLASS" },
      { name: "description", content: "A verified Adamas student profile." },
    ],
  }),
  component: () => (
    <Gate>
      <PersonPage />
    </Gate>
  ),
});

function PersonPage() {
  const { userId } = Route.useParams();
  const navigate = useNavigate();
  const { data: me } = useQuery(meQuery);
  const uid = me?.user.id;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["person", userId],
    enabled: !!uid,
    queryFn: async () => {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select(PROFILE_COLUMNS)
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!profile) return null;

      const [urls, matchResult] = await Promise.all([
        signedUrls("photos", profile.photo_paths ?? []),
        supabase
          .from("matches")
          .select("id")
          .or(`and(user_a.eq.${uid},user_b.eq.${userId}),and(user_a.eq.${userId},user_b.eq.${uid})`)
          .maybeSingle(),
      ]);

      return {
        profile,
        photos: (profile.photo_paths ?? []).flatMap((path) => (urls[path] ? [urls[path]] : [])),
        prompts: readPrompts(profile.prompts),
        matchId: matchResult.data?.id ?? null,
      };
    },
  });

  async function report() {
    if (!uid) return;
    const reason = prompt("What happened? Moderators will review this.");
    if (!reason) return;
    try {
      await submitReport(uid, userId, reason);
      toast.success("Report sent to moderators");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send that report");
    }
  }

  async function block() {
    if (!uid) return;
    const name = data?.profile.display_name ?? "this person";
    if (!confirm(`Block ${name}? They will disappear from Discover and any match ends.`)) return;
    try {
      await blockUser(uid, userId);
      toast.success("Blocked");
      navigate({ to: "/discover" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not block this person");
    }
  }

  if (isLoading)
    return (
      <main className="mx-auto max-w-3xl px-5 py-14 md:px-8">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    );

  if (isError)
    return (
      <main className="mx-auto max-w-3xl px-5 py-14 md:px-8">
        <PageHeading
          eyebrow="Something went wrong"
          title="We couldn’t load this profile."
          description="Check your connection and try again."
        />
        <Button variant="outline" className="mt-6" onClick={() => refetch()}>
          Try again
        </Button>
      </main>
    );

  if (!data)
    return (
      <main className="mx-auto max-w-3xl px-5 py-14 md:px-8">
        <PageHeading
          eyebrow="Profile unavailable"
          title="This profile isn’t visible."
          description="It may belong to an unverified student, or you may have blocked each other."
        />
        <Button asChild variant="outline" className="mt-6">
          <Link to="/discover">Back to Discover</Link>
        </Button>
      </main>
    );

  if (!uid) return null;

  if (uid === userId)
    return (
      <main className="mx-auto max-w-3xl px-5 py-14 md:px-8">
        <PageHeading
          eyebrow="That’s you"
          title="This is your profile."
          description="Edit your photos, prompts, and details from your profile page."
        />
        <Button asChild className="mt-6">
          <Link to="/profile">Edit my profile</Link>
        </Button>
      </main>
    );

  const { profile, photos, prompts, matchId } = data;

  return (
    <main className="mx-auto max-w-3xl px-5 py-14 md:px-8 md:py-20">
      <ProfileCard
        photos={photos}
        name={profile.display_name}
        birthdate={profile.birthdate}
        course={profile.course}
        year={profile.year}
        bio={profile.bio}
        interests={profile.interests}
        prompts={prompts}
        actions={
          <>
            {matchId ? (
              <Button asChild>
                <Link to="/messages/$matchId" params={{ matchId }}>
                  Message
                </Link>
              </Button>
            ) : (
              <Button variant="outline" onClick={report}>
                Report
              </Button>
            )}
            <Button variant="outline" onClick={block}>
              Block
            </Button>
            {!matchId && (
              <SuperLikeButton senderId={uid} targetId={userId} targetName={profile.display_name} />
            )}
          </>
        }
      />
      <div className="mt-4 flex flex-wrap justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/discover">Back to Discover</Link>
        </Button>
        {matchId && (
          <Button variant="ghost" size="sm" onClick={report}>
            Report
          </Button>
        )}
      </div>
    </main>
  );
}
