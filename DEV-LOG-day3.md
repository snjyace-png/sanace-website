# Sanace Website — Dev Log

## Day 3 — 2026-08-19

**Hours worked:** ~5h

### Summary

A big one — new Showreel section, the Work carousel got a seamless infinite loop, every project now has its own page, a private Studio Log tool, and the Contact section became a real inline form instead of a bare mailto link.

**Hero**
- Softer letter-flip settle (no overshoot), continuous down-to-up loop instead of a one-shot reveal
- Height/centering tuned a few times — settled on `80vh`, true symmetric centering, then nudged slightly up

**Header**
- Collapses into a small floating pill (theme toggle + Contact) once scrolled past the hero, instead of staying full-width the whole page
- The pill now shows a "SANACE" wordmark (same bold uppercase font as the hero title) that links back home
- Studio Log uses this compact pill permanently rather than the full-length header, since there's no hero to scroll past there

**New Showreel section**
- Full-bleed autoplaying, looping video placeholder right after the hero
- Locked to a true 16:9 (Full HD) aspect ratio regardless of screen size, rather than stretching to match the viewport

**Work carousel**
- Rebuilt into a centered "peek" carousel with a seamless infinite loop — cards clone-and-snap at the wrap instead of visibly reversing across every card
- Touch swipe support added (previously wheel/arrows/dots only — no way to navigate on a phone at all)
- Wider cards on narrow screens

**Multi-page project pages**
- Each of the 10 Work cards now links to its own page (`work/01.html` through `work/10.html`), matching category
- Clicking anywhere on the already-centered card opens its page, not just the title text

**Studio Log**
- New private, password-gated internal tool (`studio-log.html`) — a project directory with New Leads / Ongoing / Completed columns, add/edit/delete, stored per-browser (no backend)
- Discussed real cross-device database options (Supabase, or just using Notion/Airtable directly) — held off for now in favor of the simpler local version

**Contact section**
- Replaced the bare `mailto:` link with a real inline form (via Web3Forms) — submits without leaving the page, shows a live "message sent" confirmation
- Reframed with more casual copy and reordered fields: service dropdown first, then name, then a choice between email or phone (only one shows at a time), then message

**Layout polish**
- Services and Contact given the same `80vh` + centered treatment as Hero/Work
- Removed the numbered section-marker row ("02 //Services" etc.) from every homepage section and re-centered what's left (About didn't have height/centering set up yet — added it)
- Fixed two identical bugs: the Work filter tabs and the Studio Log's password gate were both silently not hiding, caused by the same `[hidden]` vs `display` CSS specificity collision

**Responsive pass**
- Added a `dvh` viewport-height fallback across Hero/Work/Showreel/Services/Contact, so full-screen sections size correctly against mobile browsers' address-bar behavior instead of `vh` alone

### Open items for next session
- Case-study curation still pending — Work section and the 10 project pages still need real content/images
- Contact form needs a real Web3Forms access key pasted in before it'll actually send (currently a placeholder)
- Studio Log's password is still the placeholder `changeme` — needs to be set to something real before relying on it
- No real photography/footage yet (hero video mask, showreel, work thumbnails)
- Domain not purchased; contact email is a placeholder (`hello@sanace.com`)
- Header still has no nav links (dropped to match the FXF reference layout) — revisit if that's a problem
