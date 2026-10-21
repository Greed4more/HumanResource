import { ArrowRight, BookOpen, Heart, LockKeyhole, Shield, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { demoProfiles, type DemoProfile } from "@/components/afterclass/data";
import { ContentSection, PageHeading, SiteFrame } from "@/components/afterclass/shell";
import { Button } from "@/components/ui/button";

const pageCopy = {
  safety: {
    eyebrow: "Safety, by design",
    title: "Privacy is part of the connection.",
    description:
      "A dating community should make boundaries easy to set and trust difficult to fake.",
    section: "Tools you can use",
    body: "Only approved 18+ students can see profiles. You can block or report anyone from a chat — blocking instantly ends the match and hides you from each other. Reports go straight to moderators.",
  },
  privacy: {
    eyebrow: "Your details belong to you",
    title: "Privacy comes before profiles.",
    description: "How AFTERCLASS handles your account, profile, photos, and student ID.",
    section: "What we keep and who sees it",
    body: "We store your student email, the profile you write, your photo, and your college ID. Your photo and profile are shown only to other approved students. Your college ID is visible only to you and the moderators who check it, and is never shown on your profile. Likes stay private unless they are mutual, and messages can only be read by the two people in the match. Exact location is never collected. AFTERCLASS is an independent student-focused project, not an official university service.",
  },
  guidelines: {
    eyebrow: "Community guidelines",
    title: "Kindness is the minimum.",
    description: "A thoughtful, respectful, entirely opt-in community for adult Adamas students.",
    section: "The basics",
    body: "Respect a no. Be honest about who you are. Do not harass, threaten, impersonate, or share another person’s private information. Report safety concerns; never retaliate or pressure someone to respond. Accounts that break these rules can be removed by moderators.",
  },
  contact: {
    eyebrow: "Get in touch",
    title: "We’re here to help.",
    description:
      "AFTERCLASS is an independent student-focused project and is not operated by or affiliated with Adamas University.",
    section: "Reporting a problem",
    body: "If someone makes you uncomfortable, open their profile or your chat with them and use Report or Block — reports go straight to our student moderators, who review every one. Questions about your ID check are answered in the note shown on your profile page after review.",
  },
} as const;

type PageKind = keyof typeof pageCopy;

const contactEmail = (import.meta.env["VITE_CONTACT_EMAIL"] ?? "").trim();

export function ProfilePreview({
  profile,
  featured = false,
}: {
  profile: DemoProfile;
  featured?: boolean;
}) {
  return (
    <article className="group relative border border-border bg-card">
      <div className="relative aspect-[4/5] overflow-hidden bg-secondary">
        <img
          src={profile.photo}
          alt={`Fictional demo portrait for ${profile.name}`}
          className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
        />
        <span className="absolute left-3 top-3 border border-border bg-background/90 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-foreground">
          Fictional demo
        </span>
        {featured && (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 border border-border bg-background/90 px-2 py-1 text-xs text-foreground">
            <Sparkles aria-hidden="true" className="size-3.5 text-primary" /> A little more like you
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-display text-lg font-semibold text-foreground">
            {profile.name}, {profile.age}
          </h3>
          <span className="text-xs text-muted-foreground">{profile.year}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{profile.course}</p>
        <p className="mt-3 text-sm leading-6 text-secondary-foreground">{profile.bio}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {profile.interests.map((interest) => (
            <span
              key={interest}
              className="border border-border px-2 py-1 text-[11px] text-muted-foreground"
            >
              {interest}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

export function LandingPage() {
  return (
    <SiteFrame>
      <main>
        <section className="editorial-grid border-b border-border">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 md:grid-cols-[1fr_0.9fr] md:px-8 md:py-20">
            <div className="rise-in max-w-2xl">
              <p className="mb-6 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                A more intentional way to meet
              </p>
              <h1 className="font-display text-5xl font-semibold leading-[1.04] text-foreground md:text-6xl">
                Some connections happen <span className="text-primary">after class.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
                A more personal way to meet people from your university.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to="/auth">
                    Get started <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/" hash="how-it-works">
                    How it works
                  </Link>
                </Button>
              </div>
              <p className="mt-5 max-w-lg text-xs leading-5 text-muted-foreground">
                An independent student-focused project. Not affiliated with or endorsed by Adamas
                University.
              </p>
            </div>
            <div
              className="grid grid-cols-2 gap-3 md:gap-4"
              aria-label="Fictional profile previews"
            >
              {demoProfiles.slice(0, 2).map((profile, index) => (
                <div key={profile.name} className={index === 1 ? "mt-10" : "-mb-5"}>
                  <ProfilePreview profile={profile} featured={index === 0} />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-20">
          <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                A thoughtful beginning
              </p>
              <h2 className="mt-3 font-display text-3xl font-semibold text-foreground">
                Good connections start with trust.
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-muted-foreground">
              A quieter space for adult students to meet, with care built into every step.
            </p>
          </div>
          <div className="grid gap-0 border-y border-border md:grid-cols-3 md:divide-x md:divide-border">
            <Feature
              icon={<Shield aria-hidden="true" />}
              title="A verified community"
              text="Only 18+ students with an @stu.adamasuniversity.ac.in email and an approved college ID can join."
            />
            <Feature
              icon={<Heart aria-hidden="true" />}
              title="Mutual connections"
              text="A match only happens when both people choose to connect."
            />
            <Feature
              icon={<LockKeyhole aria-hidden="true" />}
              title="Privacy first"
              text="Personal details, private likes, and conversations stay protected by design."
            />
          </div>
        </section>
        <section id="how-it-works" className="border-y border-border bg-panel">
          <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 md:grid-cols-[1fr_auto] md:items-center md:px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                How to join
              </p>
              <h2 className="mt-3 font-display text-2xl font-semibold text-foreground">
                Three steps, then you are in.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                Sign up with your student email, confirm it, then build your profile and upload your
                college ID. Once a moderator approves you, discovery and messaging open up.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link to="/safety">
                Our safety principles <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>
      </main>
    </SiteFrame>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex gap-4 py-7 md:px-6 md:first:pl-0 md:last:pr-0">
      <span className="mt-0.5 text-primary">{icon}</span>
      <div>
        <h3 className="font-display text-lg font-semibold text-foreground">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

export function InformationPage({ kind }: { kind: PageKind }) {
  const info = pageCopy[kind];
  return (
    <SiteFrame>
      <main className="mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-20">
        <PageHeading eyebrow={info.eyebrow} title={info.title} description={info.description} />
        <div className="mt-12 max-w-3xl">
          <ContentSection title={info.section}>
            <p>{info.body}</p>
            {kind === "contact" &&
              (contactEmail ? (
                <p className="mt-4">
                  Email us at{" "}
                  <a
                    className="text-foreground underline underline-offset-4"
                    href={`mailto:${contactEmail}`}
                  >
                    {contactEmail}
                  </a>
                  .
                </p>
              ) : (
                <p className="mt-4">
                  A public contact address is being set up. In the meantime, use Report or Block
                  inside the app.
                </p>
              ))}
            <p className="mt-4 inline-flex items-center gap-2">
              <BookOpen aria-hidden="true" className="size-4 text-primary" />
              Learn about{" "}
              <Link to="/guidelines" className="text-foreground underline underline-offset-4">
                community guidelines
              </Link>{" "}
              and{" "}
              <Link to="/privacy" className="text-foreground underline underline-offset-4">
                privacy
              </Link>
              .
            </p>
          </ContentSection>
        </div>
      </main>
    </SiteFrame>
  );
}

export function getPageInfo(kind: PageKind) {
  return pageCopy[kind];
}
