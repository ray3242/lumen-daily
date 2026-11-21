# Demo shot list — 55 seconds

- **0–6s, mobile start:** Show Lumen, daily date, difficulty and Play. Voice: “One light-routing puzzle, inside a Reddit post, every day.”
- **6–15s, first move:** Play, turn a mirror. Let the hint disappear. Voice: “Tap mirrors to steer the beam through every crystal.”
- **15–25s, board:** Show a crystal ignite, undo a turn, then continue. Enable sound once. Voice: “The beam updates as you move. Fewer turns is better.”
- **25–35s, solve:** Complete the route and save. Hold the solve animation and result card. Voice: “The server checks the route. The result shows turns against the true minimum, time, streak and rank.”
- **35–43s, result:** Point to Share as a comment, subscription and flair. Do not imply a local preview made a Reddit comment. Voice: “On Reddit, score sharing is optional and spoiler-free.”
- **43–50s, desktop:** Show the start screen and next-puzzle countdown. Voice: “Everyone gets the same board. A new puzzle arrives at midnight UTC.”
- **50–55s, close:** Hold the result. Voice: “Lumen. Turn the mirrors. Light every crystal.”

Record the local harness at 390×780 and 1280×800. `tools/screenshots.ts` demonstrates solving via the local-only solution endpoint; the production server has no such route. Capture Reddit integration footage only after owner playtesting. Keep the video below 60 seconds.

## Supplied gameplay recordings

`/home/ubuntu/repos/lumen-shots/demo-portrait.mp4` (540×960) and `demo-landscape.mp4` (1280×720) are silent, approximately 25-second H.264 gameplay previews. They show the start, first-turn hint, six real mirror taps spaced 900ms apart, solved board, result card with elapsed time, and optional Share action. The final message explicitly identifies sharing as a local preview; no Reddit comment is posted. They can be uploaded as-is or used beneath narration.

With the local harness running, reproduce the recordings with:

```sh
npx playwright install ffmpeg
npx tsx tools/record-demo.ts
ffmpeg -y -i ../lumen-shots/demo-portrait.webm -c:v libx264 -crf 20 -pix_fmt yuv420p -movflags +faststart ../lumen-shots/demo-portrait.mp4
ffmpeg -y -i ../lumen-shots/demo-landscape.webm -c:v libx264 -crf 20 -pix_fmt yuv420p -movflags +faststart ../lumen-shots/demo-landscape.mp4
```

The automation checks that the server saves a real solution at par, that recorded elapsed time matches the result card, and that neither recording produces console errors. Video files stay outside the repository.
