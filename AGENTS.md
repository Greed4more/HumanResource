# AGENTS.md

## Project rules

- Light/dark theme: dark tokens live on `:root`, light overrides on `:root.light` in `src/styles.css`; the `.light` class is set before paint by `themeInitScript` and toggled by `ThemeToggle`. Why: one token set per theme keeps every page themed with no per-component colour logic.
- The Discover card is the shared `ProfileCard` component; the profile page preview renders the same component. Why: the preview must always match what other students see.
- Photo/prompt limits and the prompt question list live in `src/lib/profile-extras.ts`; the database guard enforces the same caps. Why: one source for the UI, with the database as the backstop.
- Controlled Radix `Select` handlers ignore empty values (`v && …`). Why: Radix can fire `onValueChange("")` on remount, which silently cleared saved choices.
- Database changes go in `supabase/migrations/` and must be applied with the Supabase CLI (`supabase db push`). Do not edit production tables by hand. Why: a fresh environment must be reproducible from the repo.
- Never grant `select` on `profiles.email` to `authenticated`; the admin RPCs are the only path for moderators to see student emails. Why: row-level security does not hide columns, so a table-level grant would expose every student's email.
- Storage buckets (`photos`, `id-cards`) are private and created by migration. Keep them private. Why: ID cards are sensitive documents.
- This is an independent project. Do not add vendor-specific packages, scripts, env vars, or hosting assumptions.
