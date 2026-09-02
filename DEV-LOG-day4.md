# Sanace Website — Dev Log

## Day 4 — 2026-09-02

**Hours worked:** ~1-2h

### Summary

A focused, smaller session — added a whole new project category, Paintings, complete with its own dynamic gallery page.

**Paintings folder + manifest**
- New `paintings/` folder for dropping in image files directly
- Since this is a static site with no build step, the gallery reads from a small hand-maintained list (`js/paintings-manifest.js`) rather than auto-scanning the folder — one line added per new painting, kept intentionally simple
- Added a short README in the folder explaining the drop-in-and-list-it workflow

**Work carousel: new Paintings category**
- Added a 4th filter tab, "Paintings," alongside Storyboarding & Concept Art / 3D Visualization / Production Design
- Added one carousel card linking out to the new gallery page
- No JS changes needed — the existing filter logic was already generic across categories

**New dynamic gallery page (`paintings.html`)**
- Paintings come in all sorts of different aspect ratios (portrait, landscape, square) — built a CSS-columns masonry grid instead of a fixed grid, so everything packs tightly with no gaps or forced cropping
- Column count adjusts responsively (1 column on mobile up to 4 on wide screens)
- Same header/footer chrome as the other standalone pages (collapsed pill header, theme toggle)

### Open items for next session
- Case-study curation still pending — Work section and the 10 project pages still need real content/images
- Contact form needs a real Web3Forms access key pasted in before it'll actually send (currently a placeholder)
- Studio Log's password is still the placeholder `changeme` — needs to be set to something real before relying on it
- No real photography/footage yet (hero video mask, showreel, work thumbnails)
- No paintings uploaded yet — `js/paintings-manifest.js` is currently empty, gallery shows an empty-state message
- Domain not purchased; contact email is a placeholder (`hello@sanace.com`)
- Header still has no nav links (dropped to match the FXF reference layout) — revisit if that's a problem
