# Paintings folder

Drop your painting image files in here (`.jpg` or `.png`, any size, any aspect ratio — the gallery handles portrait, landscape, and square all mixed together).

## After adding an image

The gallery page (`paintings.html`) doesn't automatically detect new files — it reads a small list in `js/paintings-manifest.js`. After adding an image here, open that file and add one line for it, following the existing pattern. That's the only extra step.

Suggested naming: `01.jpg`, `02.jpg`, `03.jpg`, ... — keeps things simple and matches the manifest order.
