import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeading } from "@/components/afterclass/shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ageFrom, meQuery, signedUrls } from "@/lib/afterclass";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Moderation · AFTERCLASS" },
      { name: "description", content: "Review IDs and reports." },
    ],
  }),
  component: Admin,
});

function Admin() {
  const qc = useQueryClient();
  const {
    data: me,
    isLoading: meLoading,
    isError: meError,
    refetch: refetchMe,
  } = useQuery(meQuery);
  const isAdmin = !!me?.isAdmin;

  const {
    data: pending,
    isLoading: pendingLoading,
    isError: pendingError,
    refetch: refetchPending,
  } = useQuery({
    queryKey: ["admin-verifications"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data: rows, error } = await supabase.rpc("admin_pending_verifications");
      if (error) throw error;
      const urls = await signedUrls(
        "id-cards",
        (rows ?? []).map((row) => row.id_card_path),
      );
      return (rows ?? []).map((row) => ({
        ...row,
        url: urls[row.id_card_path],
      }));
    },
  });

  const {
    data: reports,
    isLoading: reportsLoading,
    isError: reportsError,
    refetch: refetchReports,
  } = useQuery({
    queryKey: ["admin-reports"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_open_reports");
      if (error) throw error;
      return data ?? [];
    },
  });

  const {
    data: suspended,
    isLoading: suspendedLoading,
    isError: suspendedError,
    refetch: refetchSuspended,
  } = useQuery({
    queryKey: ["admin-suspended"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_suspended_users");
      if (error) throw error;
      return data ?? [];
    },
  });

  const {
    data: hiddenProfiles,
    isLoading: hiddenLoading,
    isError: hiddenError,
    refetch: refetchHidden,
  } = useQuery({
    queryKey: ["admin-hidden"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_hidden_profiles");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function review(userId: string, status: "approved" | "rejected") {
    const note =
      status === "rejected" ? (prompt("Reason shown to the student (optional)") ?? "") : null;
    const { error } = await supabase
      .from("verifications")
      .update({ status, note })
      .eq("user_id", userId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(status === "approved" ? "Student approved" : "Student notified");
    qc.invalidateQueries({ queryKey: ["admin-verifications"] });
    qc.invalidateQueries({ queryKey: ["me"] });
  }

  async function resolve(id: string) {
    const { error } = await supabase.from("reports").update({ status: "resolved" }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Report resolved");
    qc.invalidateQueries({ queryKey: ["admin-reports"] });
  }

  async function setSuspended(userId: string, suspended: boolean) {
    const { error } = await supabase.rpc("admin_set_suspended", {
      _user_id: userId,
      _suspended: suspended,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(suspended ? "Account suspended" : "Account reactivated");
    qc.invalidateQueries({ queryKey: ["admin-reports"] });
    qc.invalidateQueries({ queryKey: ["admin-verifications"] });
    qc.invalidateQueries({ queryKey: ["admin-suspended"] });
  }

  async function setHidden(userId: string, hidden: boolean) {
    const { error } = await supabase.rpc("admin_set_profile_hidden", {
      _user_id: userId,
      _hidden: hidden,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(hidden ? "Profile hidden from users" : "Profile visible to users");
    qc.invalidateQueries({ queryKey: ["admin-hidden"] });
    qc.invalidateQueries({ queryKey: ["admin-verifications"] });
    qc.invalidateQueries({ queryKey: ["discover"] });
    qc.invalidateQueries({ queryKey: ["matches"] });
    qc.invalidateQueries({ queryKey: ["incoming-super-likes"] });
  }

  if (meLoading)
    return (
      <main className="mx-auto max-w-7xl px-5 py-14 md:px-8">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    );

  if (meError)
    return (
      <main className="mx-auto max-w-7xl px-5 py-14 md:px-8">
        <p className="text-sm text-muted-foreground">We couldn’t load your account.</p>
        <Button variant="outline" className="mt-3" onClick={() => refetchMe()}>
          Try again
        </Button>
      </main>
    );

  if (!isAdmin)
    return (
      <main className="mx-auto max-w-7xl px-5 py-14 md:px-8">
        <p className="text-sm text-muted-foreground">Moderators only.</p>
      </main>
    );

  return (
    <main className="mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-20">
      <PageHeading
        eyebrow="Moderation"
        title="Keep the community safe."
        description="Approve only clear Adamas student IDs that match the profile name, for students aged 18 or over."
      />

      <h2 className="mt-12 font-display text-xl font-semibold text-foreground">
        ID checks ({pending?.length ?? 0})
      </h2>
      {pendingLoading && <p className="mt-3 text-sm text-muted-foreground">Loading ID checks…</p>}
      {pendingError && (
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">Couldn’t load ID checks.</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => refetchPending()}>
            Try again
          </Button>
        </div>
      )}
      {!pendingLoading && !pendingError && pending?.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">No IDs waiting for review.</p>
      )}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {pending?.map((v) => (
          <div key={v.user_id} className="border border-border bg-card p-4">
            {v.url && (
              <a href={v.url} target="_blank" rel="noreferrer">
                <img
                  src={v.url}
                  alt="Student ID"
                  className="max-h-64 w-full bg-secondary object-contain"
                />
              </a>
            )}
            <p className="mt-3 text-sm font-semibold text-foreground">
              {v.display_name} · age {ageFrom(v.birthdate) ?? "?"}
            </p>
            <p className="text-xs text-muted-foreground">
              {v.email} · {v.course}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => review(v.user_id, "approved")}>
                Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => review(v.user_id, "rejected")}>
                Reject
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link to="/people/$userId" params={{ userId: v.user_id }}>
                  View profile
                </Link>
              </Button>
            </div>
          </div>
        ))}
      </div>

      <h2 className="mt-12 font-display text-xl font-semibold text-foreground">
        Open reports ({reports?.length ?? 0})
      </h2>
      {reportsLoading && <p className="mt-3 text-sm text-muted-foreground">Loading reports…</p>}
      {reportsError && (
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">Couldn’t load reports.</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => refetchReports()}>
            Try again
          </Button>
        </div>
      )}
      {!reportsLoading && !reportsError && reports?.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">No open reports.</p>
      )}
      <div className="mt-4 space-y-3">
        {reports?.map((r) => (
          <div
            key={r.id}
            className="flex items-start justify-between gap-4 border border-border p-4"
          >
            <div>
              <p className="text-sm text-foreground">{r.reason}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Reported {r.reported_name ?? "deleted user"} · by{" "}
                {r.reporter_name ?? "deleted user"} · {new Date(r.created_at).toLocaleString()}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-2">
              <Button
                size="sm"
                variant={r.reported_suspended ? "outline" : "destructive"}
                onClick={() => setSuspended(r.reported, !r.reported_suspended)}
              >
                {r.reported_suspended ? "Reactivate" : "Suspend"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => resolve(r.id)}>
                Resolve
              </Button>
            </div>
          </div>
        ))}
      </div>

      <h2 className="mt-12 font-display text-xl font-semibold text-foreground">
        Suspended accounts ({suspended?.length ?? 0})
      </h2>
      {suspendedLoading && (
        <p className="mt-3 text-sm text-muted-foreground">Loading suspended accounts…</p>
      )}
      {suspendedError && (
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">Couldn’t load suspended accounts.</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => refetchSuspended()}>
            Try again
          </Button>
        </div>
      )}
      {!suspendedLoading && !suspendedError && suspended?.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">No suspended accounts.</p>
      )}
      <div className="mt-4 space-y-3">
        {suspended?.map((u) => (
          <div
            key={u.user_id}
            className="flex items-center justify-between gap-4 border border-border p-4"
          >
            <div>
              <p className="text-sm font-semibold text-foreground">{u.display_name ?? "Student"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {u.email} · suspended{" "}
                {u.suspended_at ? new Date(u.suspended_at).toLocaleString() : "recently"}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setSuspended(u.user_id, false)}>
              Reactivate
            </Button>
          </div>
        ))}
      </div>

      <h2 className="mt-12 font-display text-xl font-semibold text-foreground">
        Hidden test profiles ({hiddenProfiles?.length ?? 0})
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Hidden profiles still work for their owner and admins, but are invisible to every other
        student.
      </p>
      {hiddenLoading && (
        <p className="mt-3 text-sm text-muted-foreground">Loading hidden profiles…</p>
      )}
      {hiddenError && (
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">Couldn’t load hidden profiles.</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => refetchHidden()}>
            Try again
          </Button>
        </div>
      )}
      {!hiddenLoading && !hiddenError && hiddenProfiles?.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">No hidden profiles.</p>
      )}
      <div className="mt-4 space-y-3">
        {hiddenProfiles?.map((u) => (
          <div
            key={u.user_id}
            className="flex items-center justify-between gap-4 border border-border p-4"
          >
            <div>
              <p className="text-sm font-semibold text-foreground">{u.display_name ?? "Student"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {u.email} · hidden{" "}
                {u.hidden_at ? new Date(u.hidden_at).toLocaleString() : "recently"}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setHidden(u.user_id, false)}>
              Unhide
            </Button>
          </div>
        ))}
      </div>
    </main>
  );
}
