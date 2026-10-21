import { supabase } from "@/integrations/supabase/client";

export async function submitReport(reporterId: string, reportedId: string, reason: string) {
  const trimmed = reason.trim();
  if (trimmed.length < 3) throw new Error("Please describe what happened.");
  if (reporterId === reportedId) throw new Error("You cannot report yourself.");

  const { error } = await supabase.from("reports").insert({
    reporter: reporterId,
    reported: reportedId,
    reason: trimmed,
  });
  if (error) throw error;
}

export async function blockUser(blockerId: string, blockedId: string) {
  if (blockerId === blockedId) throw new Error("You cannot block yourself.");

  const { error } = await supabase.from("blocks").insert({
    blocker: blockerId,
    blocked: blockedId,
  });
  if (error && error.code !== "23505") throw error;
}
