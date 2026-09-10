# Animation Shorts folder

Drop your animation clips in here (`.mp4`, any resolution — the grid sizes each tile to its own video's real proportions, capped at 4 per row). Tiles autoplay muted and looped by default; clicking one opens it full-screen with sound and controls.

## After adding a clip

The gallery page (`animation-shorts.html`) doesn't automatically detect new files — it reads a small list in `js/animation-shorts-manifest.js`. After adding a video here, open that file and add one line for it, following the existing pattern (`title` and `caption` are both optional — leave them blank to add later). That's the only extra step.

Filenames don't need to follow any particular pattern — just make sure the `src` in `js/animation-shorts-manifest.js` matches whatever the file is actually called. Large source exports should be compressed before dropping them in here (e.g. `ffmpeg -i in.mp4 -vf "scale='min(1920,iw)':-2" -c:v libx264 -crf 26 -preset medium -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 128k out.mp4`) — several of the originals were 50-90MB for a few seconds of footage.
