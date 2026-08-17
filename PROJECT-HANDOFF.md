# Project Handoff: Sanace Portfolio Website

Paste this whole document as your first message in a new Claude Code session, or save it as `PROJECT.md` in your project folder and say "read PROJECT.md, let's continue."

---

## Who this is for

Sanjay — NID Ahmedabad (Animation & Film Design) trained designer and filmmaker. Works across storyboarding, concept art, 3D visualization, production design, and film art department work. Building an independent freelance/personal brand under **Sanace** (site is under this name), separate from his co-founded studio LOMONI.

Positioning: **"Systems, not silos"** — his disciplines are one connected visual system, not separate service offerings. Messaging pillars: *Systems not silos / Story before surface / NID-trained, film-tested.*

## What this project is

A personal portfolio website showcasing storyboard work, 3D visualization, and film/concept art — for both international freelance clients and the Indian film industry. Sanjay is a complete coding beginner; **all code is written by Claude**, he directs by describing what he wants and approving changes.

## Design system already decided (use this — don't reinvent it)

- **Colors:** Warm Cream `#F6F1E7` (background), Warm Ink `#171310` (text/dark), Tiger Orange `#E85D04` (accent). Optional Amber `#C99A2C` accent — undecided, ask before using.
- **Typography:** Fraunces (headlines, variable/woff2) + Inter (body). Type scale: 1.25 (Major Third) for existing system content, 1.333 (Perfect Fourth) recommended for brand touchpoints — different registers, not a conflict.
- **Graphic device:** Asymmetric diagonal stripe, used sparingly for structure/section breaks.
- **Aesthetic direction:** Minimalism with warmth, strong typography, cinematic compositions, high attention to detail — not a generic clean SaaS template look. Boldness through graphic confidence and contrast, not broad color use.
- A full brand system HTML demo already exists from earlier work — ask Sanjay if he has that file to reference before designing new pages, so visual language stays consistent.

## Where we are right now

- **Learning phase:** Sanjay is just getting comfortable with the Claude Code workflow (VS Code + Claude Code extension). A disposable `test-site` project was used purely to learn the loop — not the real site.
- **Content status:** Raw project files exist but are **not yet curated**. No final case-study selection has been made.
- **No real site code has been written yet.** This handoff is the starting point for the actual build.

## Immediate next steps (in order)

1. **Curation pass first, before any real coding.** Help Sanjay pick 4–6 strongest projects (mix of storyboard + 3D work) as case studies. For each: what it was, his role, and the best 3–5 images or a short clip.
2. **Reference gathering:** ask for 2–3 sites (any field) whose feel he's chasing, to ground "minimalism with warmth" in something concrete rather than guessing.
3. **Site structure:** once curation is done, propose a simple sitemap (Home, Work/Case Studies, About, Contact) before writing any code — Sanjay prefers strategy before visuals.
4. **Build as plain, simple static HTML/CSS/JS** (not a heavy framework) — appropriate for a beginner-maintained personal site, easy to deploy on Vercel via GitHub. Only introduce something like Next.js if a specific feature genuinely requires it (e.g. a complex interactive 3D viewer).
5. **Publishing path (already explained to Sanjay):** Claude Code pushes to a new GitHub repo → import into Vercel → live URL → custom domain later if he's bought one. He understands this flow already, don't re-explain from scratch unless he asks.

## How to work with Sanjay (his stated preferences)

- Talk straight, no over-praise, no corporate language.
- Challenge his ideas if there's a better approach — he wants a creative director, not a yes-man.
- Start with *why / who's it for / what emotion / what story* before jumping to visuals or code.
- Ask questions when information is missing rather than guessing.
- He's a total coding beginner — explain any technical step in plain language, one thing at a time, and confirm before moving on. Don't assume terminal/git familiarity.
- He values long-term, scalable systems over quick fixes — this applies to code structure too (reusable components/patterns for future case studies, not one-off pages).

## Open decisions (flag these, don't decide silently)

- Domain name (not yet purchased/finalized)
- Whether to include the optional Amber accent color
- Final 4–6 projects for case studies (pending curation)
- Devanagari typography compatibility for Fraunces (Fraunces has no native Devanagari cut) — may not be relevant to this site, but flag if regional-language content comes up
