import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { matchesQueryKey } from "@/lib/afterclass";

const MAX_SUPER_LIKE_MESSAGE = 300;

function todayInIndia() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function useSuperLikeStatus(senderId: string | undefined) {
  return useQuery({
    queryKey: ["super-like-status", senderId],
    enabled: !!senderId,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("super_likes")
        .select("id, target_id")
        .eq("sender_id", senderId!)
        .eq("sent_on", todayInIndia())
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

type SuperLikeButtonProps = {
  senderId: string;
  targetId: string;
  targetName?: string | null;
  onSent?: () => void;
  className?: string;
};

export function SuperLikeButton({
  senderId,
  targetId,
  targetName,
  onSent,
  className,
}: SuperLikeButtonProps) {
  const qc = useQueryClient();
  const status = useSuperLikeStatus(senderId);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const usedToday = !!status.data;
  const disabled = status.isLoading || usedToday || busy;

  async function send() {
    const body = message.trim();
    if (!body) {
      toast.error("Write a short message with your super like.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("super_likes").insert({
        sender_id: senderId,
        target_id: targetId,
        message: body,
      });
      if (error) throw error;

      toast.success(`Super like sent${targetName ? ` to ${targetName}` : ""}.`);
      setOpen(false);
      setMessage("");
      await qc.invalidateQueries({ queryKey: ["super-like-status", senderId] });
      qc.invalidateQueries({ queryKey: ["discover"] });
      qc.invalidateQueries({ queryKey: ["incoming-super-likes"] });
      qc.invalidateQueries({ queryKey: matchesQueryKey });
      onSent?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send that super like");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={className ?? "col-span-2 w-full"}
        disabled={disabled}
        title={usedToday ? "You can send one super like per day (IST)" : undefined}
        onClick={() => setOpen(true)}
      >
        <Sparkles aria-hidden="true" />
        {usedToday ? "Super like used today" : "Super like"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send a super like{targetName ? ` to ${targetName}` : ""}</DialogTitle>
            <DialogDescription>
              One super like per day, resets at midnight IST. Add a message they’ll see before
              deciding — it’s also sent as a normal like.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            autoFocus
            maxLength={MAX_SUPER_LIKE_MESSAGE}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Say something worth opening…"
            aria-label="Super like message"
          />
          <p className="text-right text-xs text-muted-foreground">
            {message.length}/{MAX_SUPER_LIKE_MESSAGE}
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={busy || !message.trim()} onClick={send}>
              {busy ? "Sending…" : "Send super like"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
