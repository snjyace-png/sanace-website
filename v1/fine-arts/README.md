# Fine Arts folder

Drop your fine-arts image files in here (`.jpg` or `.png`, any size, any aspect ratio — the grid sizes each tile to its own image proportions, capped at 4 per row).

## After adding an image

The gallery page (`fine-arts.html`) doesn't automatically detect new files — it reads a small list in `js/fine-arts-manifest.js`. After adding an image here, open that file and add one line for it, following the existing pattern (`title` and `medium` are both optional — leave them blank to add later). That's the only extra step.

Filenames don't need to follow any particular pattern (the existing pieces use descriptive names like `nelson-mandela.jpg` matching their titles) — just make sure the `src` in `js/fine-arts-manifest.js` matches whatever the file is actually called.
