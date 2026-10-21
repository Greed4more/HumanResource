import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeading, SiteFrame } from "@/components/afterclass/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { pageMetadata } from "@/lib/page-metadata";

export const Route = createFileRoute("/reset-password")({
  head: () =>
    pageMetadata("Set a new password", "Choose a new password for your AFTERCLASS account."),
  component: ResetPassword,
});

function ResetPassword() {
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated");
    navigate({ to: "/discover" });
  }
  return (
    <SiteFrame>
      <main className="mx-auto max-w-xl px-5 py-14 md:py-20">
        <PageHeading
          eyebrow="Account"
          title="Set a new password."
          description="Pick something you don’t use anywhere else."
        />
        <form onSubmit={submit} className="mt-8 space-y-4">
          <Input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
          />
          <Button type="submit" className="w-full">
            Save password
          </Button>
        </form>
      </main>
    </SiteFrame>
  );
}
