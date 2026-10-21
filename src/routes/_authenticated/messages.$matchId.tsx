import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Gate } from "@/components/afterclass/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { matchesQueryKey, meQuery, signedUrls } from "@/lib/afterclass";
import { blockUser, submitReport } from "@/lib/moderation";

export const Route = createFileRoute("/_authenticated/messages/$matchId")({
  head: () => ({
    meta: [
      { title: "Chat · AFTERCLASS" },
      { name: "description", content: "A private conversation with your match." },
    ],
  }),
  component: () => (
    <Gate>
      <Chat />
    </Gate>
  ),
});

function Chat() {
  const { matchId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: me } = useQuery(meQuery);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const uid = me?.user.id;

  const {
    data: info,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["match", matchId],
    enabled: !!uid,
    queryFn: async () => {
      const { data: match, error: matchError } = await supabase
        .from("matches")
        .select("id, user_a, user_b")
        .eq("id", matchId)
        .maybeSingle();
      if (matchError) throw matchError;
      if (!match) return null;

      const otherId = match.user_a === uid ? match.user_b : match.user_a;
      const [profileResult, superResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name, photo_path")
          .eq("id", otherId)
          .maybeSingle(),
        supabase
          .from("super_likes")
          .select("sender_id, message")
          .or(
            `and(sender_id.eq.${match.user_a},target_id.eq.${match.user_b}),and(sender_id.eq.${match.user_b},target_id.eq.${match.user_a})`,
          )
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (profileResult.error) throw profileResult.error;
      if (superResult.error) throw superResult.error;
      const profile = profileResult.data;

      const urls = await signedUrls("photos", [profile?.photo_path]);
      return {
        otherId,
        name: profile?.display_name ?? "Your match",
        photo: profile?.photo_path ? urls[profile.photo_path] : undefined,
        superMessage: superResult.data?.message ?? null,
        superSenderId: superResult.data?.sender_id ?? null,
      };
    },
  });

  const {
    data: messages,
    isError: messagesError,
    refetch: refetchMessages,
  } = useQuery({
    queryKey: ["messages", matchId],
    enabled: !!info,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("match_id", matchId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []).reverse();
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`messages-${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `match_id=eq.${matchId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["messages", matchId] });
          qc.invalidateQueries({ queryKey: matchesQueryKey });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, qc]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !uid || busy) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("messages")
        .insert({ match_id: matchId, sender_id: uid, body });
      if (error) throw error;
      setText("");
      qc.invalidateQueries({ queryKey: ["messages", matchId] });
      qc.invalidateQueries({ queryKey: matchesQueryKey });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send that message");
    } finally {
      setBusy(false);
    }
  }

  async function block() {
    if (!info || !uid || !confirm(`Block ${info.name}? This ends the match for both of you.`))
      return;
    try {
      await blockUser(uid, info.otherId);
      toast.success("Blocked");
      qc.invalidateQueries({ queryKey: matchesQueryKey });
      navigate({ to: "/matches" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not block this person");
    }
  }

  async function report() {
    if (!info || !uid) return;
    const reason = prompt("What happened? Moderators will review this.");
    if (!reason) return;
    try {
      await submitReport(uid, info.otherId, reason);
      toast.success("Report sent to moderators");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send that report");
    }
  }

  async function unmatch() {
    if (!confirm("Unmatch? The conversation will be deleted.")) return;
    try {
      const { error } = await supabase.from("matches").delete().eq("id", matchId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: matchesQueryKey });
      navigate({ to: "/matches" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not unmatch");
    }
  }

  if (isLoading)
    return <p className="mx-auto max-w-3xl px-5 py-14 text-sm text-muted-foreground">Loading…</p>;

  if (isError)
    return (
      <main className="mx-auto max-w-3xl px-5 py-14">
        <p className="text-sm text-muted-foreground">We couldn’t load this conversation.</p>
        <Button variant="outline" className="mt-4" onClick={() => refetch()}>
          Try again
        </Button>
      </main>
    );

  if (!info)
    return (
      <main className="mx-auto max-w-3xl px-5 py-14">
        <p className="text-sm text-muted-foreground">This conversation isn’t available.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/matches">Back to matches</Link>
        </Button>
      </main>
    );

  return (
    <main className="mx-auto flex max-w-3xl flex-col px-5 py-8" style={{ minHeight: "70vh" }}>
      <div className="flex flex-wrap items-center gap-4 border-b border-border pb-4">
        <Link
          to="/people/$userId"
          params={{ userId: info.otherId }}
          className="flex min-w-0 flex-1 items-center gap-4"
        >
          <div className="size-12 shrink-0 overflow-hidden bg-secondary">
            {info.photo && <img src={info.photo} alt="" className="size-full object-cover" />}
          </div>
          <h1 className="truncate font-display text-xl font-semibold text-foreground hover:underline">
            {info.name}
          </h1>
        </Link>
        <Button size="sm" variant="ghost" onClick={unmatch}>
          Unmatch
        </Button>
        <Button size="sm" variant="ghost" onClick={report}>
          Report
        </Button>
        <Button size="sm" variant="outline" onClick={block}>
          Block
        </Button>
      </div>
      {info.superMessage && (
        <div className="mt-4 border border-primary/30 bg-primary/5 p-3 text-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
            {info.superSenderId === uid ? "Your super like message" : "Their super like message"}
          </p>
          <p className="mt-1 whitespace-pre-line text-foreground">{info.superMessage}</p>
        </div>
      )}
      <div className="flex-1 space-y-3 overflow-y-auto py-6">
        {messagesError && (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Messages didn’t load.</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => refetchMessages()}>
              Retry
            </Button>
          </div>
        )}
        {messages?.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">Say hello.</p>
        )}
        {messages?.map((m) => (
          <div
            key={m.id}
            className={
              m.sender_id === uid
                ? "ml-auto max-w-[75%] bg-primary px-4 py-2 text-sm text-primary-foreground"
                : "max-w-[75%] border border-border bg-card px-4 py-2 text-sm text-foreground"
            }
          >
            <p className="whitespace-pre-line">{m.body}</p>
            <p
              className={
                m.sender_id === uid
                  ? "mt-1 text-right text-[10px] text-primary-foreground/70"
                  : "mt-1 text-right text-[10px] text-muted-foreground"
              }
            >
              {new Date(m.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-border pt-4">
        <Input
          value={text}
          maxLength={2000}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a message…"
        />
        <Button type="submit" disabled={busy || !text.trim()}>
          Send
        </Button>
      </form>
    </main>
  );
}
