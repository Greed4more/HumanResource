import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export const STUDENT_DOMAIN = "@stu.adamasuniversity.ac.in";

export const matchesQueryKey = ["matches"];

export const PROFILE_COLUMNS =
  "id, display_name, birthdate, gender, interested_in, course, year, bio, interests, photo_path, photo_paths, prompts, onboarded, hidden_at, created_at";

export function isStudentEmail(email: string) {
  return email.trim().toLowerCase().endsWith(STUDENT_DOMAIN);
}

export function ageFrom(birthdate: string | null) {
  if (!birthdate) return null;
  const b = new Date(birthdate);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

export const meQuery = queryOptions({
  queryKey: ["me"],
  staleTime: 30_000,
  queryFn: async () => {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    const user = auth.user;
    if (!user) return null;

    const [profile, verification, roles] = await Promise.all([
      supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", user.id).maybeSingle(),
      supabase.from("verifications").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
    ]);

    if (profile.error) throw profile.error;
    if (verification.error) throw verification.error;
    if (roles.error) throw roles.error;

    const isAdmin = (roles.data ?? []).some((r) => r.role === "admin");
    const p = profile.data;
    const v = verification.data;
    const approved =
      !!p?.onboarded &&
      v?.status === "approved" &&
      (ageFrom(p.birthdate) ?? 0) >= 18 &&
      isStudentEmail(user.email ?? "");

    return { user, profile: p, verification: v, isAdmin, approved };
  },
});

const SIGNED_URL_BATCH = 50;

export async function signedUrls(bucket: string, paths: (string | null | undefined)[]) {
  const clean = [...new Set(paths.filter((p): p is string => !!p))];
  if (!clean.length) return {} as Record<string, string>;

  const map: Record<string, string> = {};
  for (let i = 0; i < clean.length; i += SIGNED_URL_BATCH) {
    const batch = clean.slice(i, i + SIGNED_URL_BATCH);
    const { data, error } = await supabase.storage.from(bucket).createSignedUrls(batch, 3600);
    if (error) {
      console.error("Could not create signed URLs", error);
      continue;
    }
    (data ?? []).forEach((d) => {
      if (d.path && d.signedUrl) map[d.path] = d.signedUrl;
    });
  }
  return map;
}
