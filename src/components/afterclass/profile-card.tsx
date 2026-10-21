import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { ageFrom } from "@/lib/afterclass";
import type { Prompt } from "@/lib/profile-extras";

export function parseInterests(text: string) {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);
}

type ProfileCardProps = {
  photos: string[];
  name: string | null;
  birthdate: string | null;
  course: string | null;
  year: string | null;
  bio: string | null;
  interests: string[] | null;
  prompts?: Prompt[];
  actions?: ReactNode;
};

/** The card other students see in Discover. Shared so the profile preview matches exactly. */
export function ProfileCard({
  photos,
  name,
  birthdate,
  course,
  year,
  bio,
  interests,
  prompts = [],
  actions,
}: ProfileCardProps) {
  const age = ageFrom(birthdate);
  return (
    <article className="border border-border bg-card">
      <PhotoCarousel photos={photos} name={name ?? ""} />
      <div className="p-5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl font-semibold text-foreground">
            {name || <span className="text-muted-foreground">Your name</span>}
            {age !== null && `, ${age}`}
          </h2>
          <span className="text-xs text-muted-foreground">{year}</span>
        </div>
        {course && <p className="mt-1 text-sm text-muted-foreground">{course}</p>}
        {bio && (
          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-secondary-foreground">
            {bio}
          </p>
        )}
        {(interests?.length ?? 0) > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {interests!.map((i) => (
              <span
                key={i}
                className="border border-border px-2 py-1 text-[11px] text-muted-foreground"
              >
                {i}
              </span>
            ))}
          </div>
        )}
        {prompts.length > 0 && (
          <div className="mt-5 space-y-3">
            {prompts.map((p) => (
              <div key={p.question} className="border border-border bg-panel p-4">
                <p className="text-xs font-medium text-muted-foreground">{p.question}</p>
                <p className="mt-2 whitespace-pre-line font-display text-lg leading-snug text-foreground">
                  {p.answer}
                </p>
              </div>
            ))}
          </div>
        )}
        {actions && <div className="mt-6 grid grid-cols-2 gap-3">{actions}</div>}
      </div>
    </article>
  );
}

function PhotoCarousel({ photos, name }: { photos: string[]; name: string }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (index > photos.length - 1) setIndex(Math.max(0, photos.length - 1));
  }, [photos.length, index]);
  const count = photos.length;
  const go = (d: number) => setIndex((i) => Math.min(count - 1, Math.max(0, i + d)));

  if (!count) {
    return (
      <div className="grid aspect-[4/5] place-items-center bg-secondary">
        <span className="text-xs text-muted-foreground">No photo yet</span>
      </div>
    );
  }

  return (
    <div className="relative aspect-[4/5] overflow-hidden bg-secondary select-none">
      <img
        src={photos[index]}
        alt={`${name} — photo ${index + 1} of ${count}`}
        className="size-full object-cover"
        draggable={false}
      />
      {count > 1 && (
        <>
          <div className="absolute inset-x-2 top-2 flex gap-1" aria-hidden="true">
            {photos.map((p, i) => (
              <span
                key={p}
                className={`h-1 flex-1 rounded-full ${i === index ? "bg-primary" : "bg-background/60"}`}
              />
            ))}
          </div>
          <button
            type="button"
            aria-label="Previous photo"
            disabled={index === 0}
            onClick={() => go(-1)}
            className="group absolute inset-y-0 left-0 flex w-1/3 items-center justify-start pl-2 disabled:cursor-default"
          >
            <span className="grid size-8 place-items-center rounded-full bg-background/80 text-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 group-disabled:hidden">
              <ChevronLeft className="size-4" />
            </span>
          </button>
          <button
            type="button"
            aria-label="Next photo"
            disabled={index === count - 1}
            onClick={() => go(1)}
            className="group absolute inset-y-0 right-0 flex w-1/3 items-center justify-end pr-2 disabled:cursor-default"
          >
            <span className="grid size-8 place-items-center rounded-full bg-background/80 text-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 group-disabled:hidden">
              <ChevronRight className="size-4" />
            </span>
          </button>
        </>
      )}
    </div>
  );
}
