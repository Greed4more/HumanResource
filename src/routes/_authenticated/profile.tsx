import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Eye, Heart, Plus, Shuffle, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ProfileCard, parseInterests } from "@/components/afterclass/profile-card";
import { PageHeading } from "@/components/afterclass/shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { meQuery, signedUrls } from "@/lib/afterclass";
import {
  errorMessage,
  ID_UPLOAD_OPTIONS,
  PHOTO_UPLOAD_OPTIONS,
  prepareImageForUpload,
} from "@/lib/image-upload";
import {
  cleanPrompts,
  MAX_ANSWER,
  MAX_PHOTOS,
  MAX_PROMPTS,
  moveItem,
  PROMPT_QUESTIONS,
  randomQuestion,
  readPrompts,
  type Prompt,
} from "@/lib/profile-extras";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My profile · AFTERCLASS" },
      {
        name: "description",
        content: "Edit your AFTERCLASS photos, prompts, profile and verification.",
      },
    ],
  }),
  component: ProfilePage,
});

type PhotoItem = { key: string; url: string; path?: string; file?: File };

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
const MAX_ID_BYTES = 10 * 1024 * 1024;

function extensionFor(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

async function safeRemove(bucket: string, paths: string[]) {
  if (!paths.length) return;
  try {
    const { error } = await supabase.storage.from(bucket).remove(paths);
    if (error) console.error(`Could not remove from ${bucket}`, error);
  } catch (error) {
    console.error(`Could not remove from ${bucket}`, error);
  }
}

function fillSlots(saved: Prompt[]): Prompt[] {
  const slots = saved.slice(0, MAX_PROMPTS);
  while (slots.length < MAX_PROMPTS) {
    slots.push({ question: randomQuestion(slots.map((s) => s.question)), answer: "" });
  }
  return slots;
}

function ProfilePage() {
  const qc = useQueryClient();
  const {
    data: me,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    ...meQuery,
    refetchOnWindowFocus: false,
  });
  const [form, setForm] = useState({
    display_name: "",
    birthdate: "",
    gender: "",
    interested_in: "everyone",
    course: "",
    year: "",
    bio: "",
    interests: "",
  });
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [slots, setSlots] = useState<Prompt[]>(() => fillSlots([]));
  const [idFile, setIdFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const idInput = useRef<HTMLInputElement>(null);
  const photosRef = useRef<PhotoItem[]>([]);
  const photosTouched = useRef(false);
  const hydratedFor = useRef<string | null>(null);
  photosRef.current = photos;

  useEffect(
    () => () =>
      photosRef.current.forEach((p) => {
        if (p.file) URL.revokeObjectURL(p.url);
      }),
    [],
  );

  useEffect(() => {
    const profile = me?.profile;
    if (!profile || hydratedFor.current === profile.id) return;
    hydratedFor.current = profile.id;

    setForm({
      display_name: profile.display_name ?? "",
      birthdate: profile.birthdate ?? "",
      gender: profile.gender ?? "",
      interested_in: profile.interested_in || "everyone",
      course: profile.course ?? "",
      year: profile.year ?? "",
      bio: profile.bio ?? "",
      interests: (profile.interests ?? []).join(", "),
    });
    setSlots(fillSlots(readPrompts(profile.prompts)));

    const paths = profile.photo_paths ?? [];
    signedUrls("photos", paths).then((urls) => {
      if (photosTouched.current) return;
      setPhotos(
        paths.flatMap((path) => {
          const url = urls[path];
          return url ? [{ key: path, path, url }] : [];
        }),
      );
    });
  }, [me?.profile]);

  if (isLoading)
    return (
      <main className="mx-auto max-w-6xl px-5 py-14 md:px-8">
        <p className="text-sm text-muted-foreground">Loading your profile…</p>
      </main>
    );

  if (isError)
    return (
      <main className="mx-auto max-w-6xl px-5 py-14 md:px-8">
        <PageHeading
          eyebrow="Something went wrong"
          title="We couldn’t load your profile."
          description="Check your connection and try again."
        />
        <Button variant="outline" className="mt-6" onClick={() => refetch()}>
          Try again
        </Button>
      </main>
    );

  if (!me)
    return (
      <main className="mx-auto max-w-6xl px-5 py-14 md:px-8">
        <PageHeading
          eyebrow="Signed out"
          title="Please sign in again."
          description="Your session has ended."
        />
        <Button asChild className="mt-6">
          <Link to="/auth">Sign in</Link>
        </Button>
      </main>
    );

  const set =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [k]: e.target.value });

  function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      toast.error(`You can have up to ${MAX_PHOTOS} photos`);
      return;
    }

    const chosen: File[] = [];
    for (const file of Array.from(files)) {
      if (!IMAGE_TYPES.has(file.type)) {
        toast.error(`${file.name} isn’t a supported image. Use JPEG, PNG or WebP.`);
        continue;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        toast.error(`${file.name} is larger than 15 MB.`);
        continue;
      }
      chosen.push(file);
    }
    if (chosen.length > room) toast.error(`You can have up to ${MAX_PHOTOS} photos`);

    const added = chosen.slice(0, room).map((file, i) => ({
      key: `new-${Date.now()}-${i}`,
      file,
      url: URL.createObjectURL(file),
    }));
    if (added.length) {
      photosTouched.current = true;
      setPhotos((prev) => [...prev, ...added]);
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  function chooseIdFile(files: FileList | null) {
    let file = files?.[0] ?? null;
    if (file) {
      if (!IMAGE_TYPES.has(file.type)) {
        toast.error("The ID must be a JPEG, PNG or WebP image.");
        file = null;
      } else if (file.size > MAX_ID_BYTES) {
        toast.error("The ID image must be smaller than 10 MB.");
        file = null;
      }
    }
    setIdFile(file);
    if (!file && idInput.current) idInput.current.value = "";
  }

  function removePhoto(i: number) {
    const item = photos[i];
    if (item?.file) URL.revokeObjectURL(item.url);
    photosTouched.current = true;
    setPhotos(photos.filter((_, j) => j !== i));
  }

  function reorderPhotos(from: number, to: number) {
    photosTouched.current = true;
    setPhotos(moveItem(photos, from, to));
  }

  const setSlot = (i: number, patch: Partial<Prompt>) =>
    setSlots((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const shuffleSlot = (i: number) =>
    setSlot(i, { question: randomQuestion(slots.map((s) => s.question)) });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!me || busy) return;
    if (!me.profile) {
      toast.error("Your profile row is missing. Sign out and back in, or contact support.");
      return;
    }
    if (!photos.length) {
      toast.error("Add at least one photo");
      return;
    }
    if (!form.gender) {
      toast.error("Choose how you identify under “I am”");
      return;
    }
    const prompts = cleanPrompts(slots);
    if (!prompts.length) {
      toast.error("Answer at least one question so people have something to talk about");
      return;
    }

    setBusy(true);
    const uploadedPhotos: string[] = [];
    let profileSaved = false;

    try {
      const photo_paths: string[] = [];
      for (const [i, item] of photos.entries()) {
        if (item.path) {
          photo_paths.push(item.path);
          continue;
        }
        const file = item.file;
        if (!file) continue;
        const prepared = await prepareImageForUpload(file, PHOTO_UPLOAD_OPTIONS).catch(() => ({
          file,
          width: 0,
          height: 0,
        }));
        const path = `${me.user.id}/photo-${Date.now()}-${i}.${extensionFor(prepared.file.type)}`;
        let upload;
        try {
          upload = await supabase.storage
            .from("photos")
            .upload(path, prepared.file, { contentType: prepared.file.type });
        } catch {
          throw new Error(`Could not upload photo ${i + 1}. Check your connection and try again.`);
        }
        if (upload.error) {
          throw new Error(`Could not upload photo ${i + 1}: ${upload.error.message}`);
        }
        uploadedPhotos.push(path);
        photo_paths.push(path);
      }

      let profileUpdate;
      try {
        profileUpdate = await supabase
          .from("profiles")
          .update({
            display_name: form.display_name.trim(),
            birthdate: form.birthdate,
            gender: form.gender,
            interested_in: form.interested_in,
            course: form.course.trim(),
            year: form.year.trim(),
            bio: form.bio.trim(),
            interests: parseInterests(form.interests),
            photo_paths,
            prompts,
            onboarded: true,
          })
          .eq("id", me.user.id);
      } catch {
        throw new Error("Could not save your profile. Check your connection and try again.");
      }
      if (profileUpdate.error) throw new Error(profileUpdate.error.message);
      profileSaved = true;

      // New uploads now have a storage path; keep them from uploading again if
      // the user saves twice without leaving the page.
      setPhotos((prev) =>
        prev.map((item, i) => {
          const path = photo_paths[i];
          return path && !item.path ? { ...item, path } : item;
        }),
      );

      const removed = (me.profile?.photo_paths ?? []).filter((p) => !photo_paths.includes(p));
      await safeRemove("photos", removed);

      if (idFile) {
        const preparedId = await prepareImageForUpload(idFile, ID_UPLOAD_OPTIONS).catch(() => ({
          file: idFile,
          width: 0,
          height: 0,
        }));
        const path = `${me.user.id}/id-${Date.now()}.${extensionFor(preparedId.file.type)}`;
        let upload;
        try {
          upload = await supabase.storage
            .from("id-cards")
            .upload(path, preparedId.file, { contentType: preparedId.file.type });
        } catch {
          throw new Error("Could not upload your college ID. Check your connection and try again.");
        }
        if (upload.error) {
          throw new Error(`Could not upload your college ID: ${upload.error.message}`);
        }

        let verification;
        try {
          verification = await supabase
            .from("verifications")
            .upsert({ user_id: me.user.id, id_card_path: path });
        } catch {
          await safeRemove("id-cards", [path]);
          throw new Error("Could not save your ID check. Check your connection and try again.");
        }
        if (verification.error) {
          await safeRemove("id-cards", [path]);
          throw new Error(verification.error.message);
        }

        const oldPath = me.verification?.id_card_path;
        if (oldPath && oldPath !== path) {
          const { error: removeError } = await supabase.storage.from("id-cards").remove([oldPath]);
          if (removeError) console.error("Could not remove the previous ID", removeError);
        }

        setIdFile(null);
        if (idInput.current) idInput.current.value = "";
      }

      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["person", me.user.id] });
    } catch (error) {
      if (!profileSaved) await safeRemove("photos", uploadedPhotos);
      toast.error(errorMessage(error, "Could not save"));
    } finally {
      setBusy(false);
    }
  }

  const verification = me.verification;
  const status = !verification
    ? "Not submitted"
    : verification.status === "approved"
      ? "Approved"
      : verification.status === "rejected"
        ? `Not approved${verification.note ? ` — ${verification.note}` : ""}`
        : "Waiting for review";
  const answered = slots.filter((s) => s.answer.trim()).length;
  const preview = (
    <ProfileCard
      photos={photos.map((p) => p.url)}
      name={form.display_name.trim()}
      birthdate={form.birthdate || null}
      course={form.course.trim()}
      year={form.year.trim()}
      bio={form.bio.trim()}
      interests={parseInterests(form.interests)}
      prompts={cleanPrompts(slots)}
      actions={
        <>
          <Button type="button" variant="outline" size="lg" disabled tabIndex={-1}>
            <X aria-hidden="true" /> Pass
          </Button>
          <Button type="button" size="lg" disabled tabIndex={-1}>
            <Heart aria-hidden="true" /> Like
          </Button>
        </>
      }
    />
  );

  return (
    <main className="mx-auto max-w-6xl px-5 py-14 md:px-8 md:py-20">
      <PageHeading
        eyebrow="Your profile"
        title="Share the details that matter."
        description="Only approved students can see your profile. Your email and college ID are never shown to anyone except moderators."
      />
      <div className="mt-6 flex flex-wrap gap-3">
        {me.approved && (
          <Button asChild>
            <Link to="/discover">Start discovering</Link>
          </Button>
        )}
        <Dialog>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" className="lg:hidden">
              <Eye aria-hidden="true" /> Preview my card
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto p-4">
            <DialogHeader>
              <DialogTitle>How you’ll appear in Discover</DialogTitle>
              <DialogDescription>
                This updates as you type. Nothing is saved until you press Save profile.
              </DialogDescription>
            </DialogHeader>
            {preview}
          </DialogContent>
        </Dialog>
      </div>
      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={save} className="grid content-start gap-5 md:grid-cols-2">
          <fieldset className="md:col-span-2">
            <legend className="text-sm font-medium text-foreground">
              Photos{" "}
              <span className="text-muted-foreground">
                · {photos.length}/{MAX_PHOTOS}
              </span>
            </legend>
            <p className="mt-1 text-xs text-muted-foreground">
              Add up to {MAX_PHOTOS}. The first photo is your main one — use the arrows to change
              the order. JPEG, PNG or WebP, up to 15 MB each — large photos are resized before
              upload.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {photos.map((p, i) => (
                <div
                  key={p.key}
                  className="relative aspect-[4/5] overflow-hidden border border-border bg-secondary"
                >
                  <img src={p.url} alt={`Your photo ${i + 1}`} className="size-full object-cover" />
                  {i === 0 && (
                    <span className="absolute left-1.5 top-1.5 bg-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                      Main
                    </span>
                  )}
                  <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between gap-1">
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className="size-7"
                        aria-label={`Move photo ${i + 1} earlier`}
                        disabled={i === 0}
                        onClick={() => reorderPhotos(i, i - 1)}
                      >
                        <ChevronLeft />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className="size-7"
                        aria-label={`Move photo ${i + 1} later`}
                        disabled={i === photos.length - 1}
                        onClick={() => reorderPhotos(i, i + 1)}
                      >
                        <ChevronRight />
                      </Button>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="size-7"
                      aria-label={`Remove photo ${i + 1}`}
                      onClick={() => removePhoto(i)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="grid aspect-[4/5] place-items-center border border-dashed border-border bg-secondary/40 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  <span className="flex flex-col items-center gap-1 text-xs">
                    <Plus aria-hidden="true" className="size-5" />
                    Add photos
                  </span>
                </button>
              )}
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              aria-label="Add photos"
              onChange={(e) => addFiles(e.target.files)}
            />
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="name">Display name</Label>
            <Input
              id="name"
              required
              maxLength={40}
              value={form.display_name}
              onChange={set("display_name")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dob">Date of birth (18+ only)</Label>
            <Input
              id="dob"
              type="date"
              required
              value={form.birthdate}
              onChange={set("birthdate")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gender">I am</Label>
            <Select
              value={form.gender}
              onValueChange={(v) => v && setForm((f) => ({ ...f, gender: v }))}
            >
              <SelectTrigger id="gender" className="w-full">
                <SelectValue placeholder="Choose…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="woman">A woman</SelectItem>
                <SelectItem value="man">A man</SelectItem>
                <SelectItem value="nonbinary">Non-binary</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="int">Show me</Label>
            <Select
              value={form.interested_in}
              onValueChange={(v) => v && setForm((f) => ({ ...f, interested_in: v }))}
            >
              <SelectTrigger id="int" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="everyone">Everyone</SelectItem>
                <SelectItem value="woman">Women</SelectItem>
                <SelectItem value="man">Men</SelectItem>
                <SelectItem value="nonbinary">Non-binary people</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="course">Course</Label>
            <Input
              id="course"
              maxLength={60}
              value={form.course}
              onChange={set("course")}
              placeholder="e.g. B.Tech CSE"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="year">Year</Label>
            <Input
              id="year"
              maxLength={20}
              value={form.year}
              onChange={set("year")}
              placeholder="e.g. 3rd year"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" maxLength={300} value={form.bio} onChange={set("bio")} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="interests">Interests (comma separated, up to 8)</Label>
            <Input
              id="interests"
              value={form.interests}
              onChange={set("interests")}
              placeholder="Music, Film, Coffee"
            />
          </div>

          <fieldset className="space-y-4 md:col-span-2">
            <legend className="text-sm font-medium text-foreground">
              Answer a few questions{" "}
              <span className="text-muted-foreground">
                · {answered}/{MAX_PROMPTS}
              </span>
            </legend>
            <p className="mt-1 text-xs text-muted-foreground">
              Answers give people an easy way to start a conversation. Answer at least one — all
              three helps you stand out. Don’t like a question? Shuffle it or pick another.
            </p>
            {slots.map((s, i) => (
              <div key={i} className="border border-border bg-panel p-4">
                <div className="flex gap-2">
                  <Select
                    value={s.question}
                    onValueChange={(q) => q && setSlot(i, { question: q })}
                  >
                    <SelectTrigger aria-label={`Question ${i + 1}`} className="w-full">
                      <SelectValue placeholder="Choose a question…" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROMPT_QUESTIONS.map((q) => (
                        <SelectItem
                          key={q}
                          value={q}
                          disabled={q !== s.question && slots.some((o) => o.question === q)}
                        >
                          {q}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={`Shuffle question ${i + 1}`}
                    onClick={() => shuffleSlot(i)}
                  >
                    <Shuffle />
                  </Button>
                </div>
                <Textarea
                  className="mt-3"
                  aria-label={`Your answer to: ${s.question}`}
                  placeholder="Your answer…"
                  maxLength={MAX_ANSWER}
                  value={s.answer}
                  onChange={(e) => setSlot(i, { answer: e.target.value })}
                />
                <p className="mt-1 text-right text-[11px] text-muted-foreground">
                  {s.answer.length}/{MAX_ANSWER}
                </p>
              </div>
            ))}
          </fieldset>

          <div className="border border-primary/30 bg-primary/5 p-4 md:col-span-2">
            <p className="text-sm font-semibold text-foreground">
              College ID verification · <span className="text-primary">{status}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Upload a clear photo of your Adamas student ID card. Only moderators can see it. A new
              upload replaces the old file and resets the check to pending.
            </p>
            <Input
              ref={idInput}
              className="mt-3"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => chooseIdFile(e.target.files)}
            />
            {idFile && (
              <p className="mt-2 text-xs text-muted-foreground">Selected: {idFile.name}</p>
            )}
          </div>
          <Button type="submit" disabled={busy} className="md:col-span-2">
            {busy ? "Saving…" : "Save profile"}
          </Button>
        </form>
        <aside aria-label="Profile preview" className="hidden lg:block">
          <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Live preview
            </p>
            <p className="mb-4 text-xs text-muted-foreground">
              How other students see you in Discover. Tap the sides of the photo to flip through.
              Not saved until you press Save profile.
            </p>
            {preview}
          </div>
        </aside>
      </div>
    </main>
  );
}
