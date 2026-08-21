# WavOn

Drop finished WAV mixes next to the matching videos. Get a zip of MP4s with the new audio. Files never leave the browser.

Ask this answers: [Is there a simple tool for adding multiple audio files to multiple videos?](https://gearspace.com/threads/is-there-a-simple-tool-for-adding-multiple-audio-files-to-multiple-videos.1467239/)

- No account
- No upload
- Cap: 80 MB per file, 6 videos
- Video stream is copied; mix is encoded to AAC

## Local

Open `index.html` in a browser, or:

```bash
python3 -m http.server 4173
```

First mux downloads ffmpeg.wasm into the tab (~25 MB). Needs a local server for ES modules, not a `file://` open.

## GTM

Reply to people who export a WAV mix, then export the picture again from the DAW. Copy is in the page footer.
