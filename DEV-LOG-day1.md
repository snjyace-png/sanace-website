# Sanace Website — Dev Log

## Day 1 — 2026-08-17

**Hours worked:** ~8h (12:49 PM – 8:52 PM IST, across on-and-off sessions today)

### Summary

First real day of building the site — started from the project handoff doc and ended with a live, styled, deployed homepage.

**Setup & publishing pipeline**
- Reviewed `PROJECT-HANDOFF.md` to get oriented (design system, positioning, audience, working preferences)
- Scaffolded the project: `index.html`, `css/style.css`, `js/script.js`, `assets/`
- Installed and authenticated GitHub CLI (`gh`); initialized git, created `snjyace-png/sanace-website` on GitHub, pushed initial commit
- Installed and authenticated Vercel CLI; linked and deployed the project, connected the GitHub integration for auto-deploy on push
- **Live at:** https://sanace-website.vercel.app

**Homepage content**
- Built out real sections: hero, positioning statement ("Systems, not silos"), messaging pillars, Selected Work, About, Contact, footer
- Removed the LOMONI mention from the About copy per request

**Design direction**
- Reviewed fxfmedia.com as a visual reference (screenshots + a detailed motion-language doc) and adapted it rather than cloning it 1:1 — stayed on plain HTML/CSS/JS instead of adopting its React/Next.js/GSAP stack, since the site needs to stay maintainable for a coding beginner
- Rebuilt typography around Archivo (bold display) + Inter (body/labels), replacing the original Fraunces-led system
- Added a light/dark theme toggle (persists choice, respects system preference by default)
- Added numbered section markers, a cutting-mat-style grid background, subtle film grain, a live IST clock, pill buttons, magnetic button hover, a marquee text divider, clip-path reveal animations on scroll, and staggered reveal timing
- Reworked the Work section from a card grid into a vertical timeline (newest project at the top, placeholder years for now)
- Hero: centered uppercase "SANACE" wordmark with a video-mask slot left in place for real footage later (currently showing a gradient placeholder)

### Open items for next session
- Case-study curation still pending — Work section is all placeholders
- No real photography/footage yet (hero video mask, work thumbnails)
- Domain not purchased; contact email is a placeholder (`hello@sanace.com`)
- Header currently has no nav links (dropped to match the FXF reference layout) — revisit if that's a problem
