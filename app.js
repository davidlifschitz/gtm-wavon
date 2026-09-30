import { FFmpeg } from "https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js";
import { fetchFile, toBlobURL } from "https://unpkg.com/@ffmpeg/util@0.12.1/dist/esm/index.js";

const MAX_BYTES = 80 * 1024 * 1024;
const MAX_VIDEOS = 6;
const VIDEO_EXT = new Set(["mp4", "mov", "m4v", "webm", "mkv"]);
const AUDIO_EXT = new Set(["wav", "aif", "aiff", "mp3", "m4a", "aac"]);

const els = {
  drop: document.getElementById("drop"),
  file: document.getElementById("file"),
  pick: document.getElementById("pick"),
  clear: document.getElementById("clear"),
  status: document.getElementById("status"),
  error: document.getElementById("error"),
  bar: document.getElementById("bar"),
  pairs: document.getElementById("pairs"),
  run: document.getElementById("run"),
};

let videos = [];
let audios = [];
let ffmpeg = null;
let loading = false;

function extOf(name) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function stem(name) {
  return name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[\s_\-]+/g, " ")
    .replace(/\b(mix|final|master|bounce|print|v\d+)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(name) {
  return stem(name).replace(/[^a-z0-9]/g, "");
}

function kindOf(file) {
  const ext = extOf(file.name);
  if (VIDEO_EXT.has(ext) || (file.type || "").startsWith("video/")) return "video";
  if (AUDIO_EXT.has(ext) || (file.type || "").startsWith("audio/")) return "audio";
  return null;
}

function scorePair(video, audio) {
  const vs = stem(video.name);
  const as = stem(audio.name);
  const vc = compact(video.name);
  const ac = compact(audio.name);
  if (!vs || !as) return 0;
  if (vs === as || vc === ac) return 100;
  if (vc.includes(ac) || ac.includes(vc)) return 70 + Math.min(vc.length, ac.length);
  const vTokens = new Set(vs.split(" ").filter(Boolean));
  const aTokens = as.split(" ").filter(Boolean);
  let hit = 0;
  for (const t of aTokens) if (vTokens.has(t)) hit += 1;
  if (hit === 0) return 0;
  return 20 + hit * 10;
}

export function pairFiles(videoList, audioList) {
  const used = new Set();
  const pairs = [];
  const vids = [...videoList];
  for (const video of vids) {
    let best = null;
    let bestScore = 0;
    audioList.forEach((audio, idx) => {
      if (used.has(idx)) return;
      const s = scorePair(video, audio);
      if (s > bestScore) {
        bestScore = s;
        best = { audio, idx };
      }
    });
    if (best && bestScore >= 20) {
      used.add(best.idx);
      pairs.push({ video, audio: best.audio, score: bestScore });
    } else {
      pairs.push({ video, audio: null, score: 0 });
    }
  }
  if (vids.length === 1 && audioList.length === 1 && !pairs[0].audio) {
    pairs[0] = { video: vids[0], audio: audioList[0], score: 15 };
  }
  return pairs;
}

function setError(msg) {
  els.error.hidden = !msg;
  els.error.textContent = msg || "";
}

function render() {
  const pairs = pairFiles(videos, audios);
  const ready = pairs.filter((p) => p.audio).length;
  els.status.textContent =
    videos.length || audios.length
      ? `${videos.length} video${videos.length === 1 ? "" : "s"} · ${audios.length} mix${audios.length === 1 ? "" : "es"} · ${ready} pair${ready === 1 ? "" : "s"} · files stayed in this tab`
      : "Waiting for videos and mixes.";
  els.pairs.innerHTML = pairs
    .map((p) => {
      const ok = Boolean(p.audio);
      return `<article>
        <strong>${escapeHtml(p.video.name)}</strong>
        <span class="meta">${ok ? `+ ${escapeHtml(p.audio.name)}` : "no matching mix"}</span>
      </article>`;
    })
    .join("");
  els.run.disabled = ready === 0 || loading;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function addFiles(list) {
  const skipped = [];
  for (const file of list) {
    if (file.size > MAX_BYTES) {
      skipped.push(`${file.name} is over 80 MB`);
      continue;
    }
    const kind = kindOf(file);
    if (!kind) {
      skipped.push(`${file.name} is not a video or mix I know`);
      continue;
    }
    if (kind === "video") {
      if (videos.length >= MAX_VIDEOS) {
        skipped.push(`${file.name} is past the ${MAX_VIDEOS}-video cap`);
        continue;
      }
      videos.push(file);
    } else {
      audios.push(file);
    }
  }
  setError(skipped.length ? `Skipped: ${skipped.join("; ")}.` : "");
  render();
}

async function loadFfmpeg() {
  if (ffmpeg) return ffmpeg;
  ffmpeg = new FFmpeg();
  ffmpeg.on("progress", ({ progress }) => {
    els.bar.hidden = false;
    els.bar.value = Math.max(1, Math.round((progress || 0) * 100));
  });
  const base = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
  els.status.textContent = "Loading ffmpeg into this tab (once)…";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
  });
  return ffmpeg;
}

function outName(videoName) {
  const i = videoName.lastIndexOf(".");
  const base = i >= 0 ? videoName.slice(0, i) : videoName;
  return `${base}-mix.mp4`;
}

// take.mov and take.mp4 would both become take-mix.mp4 and one would vanish from the zip.
function uniqueName(name, taken) {
  let out = name;
  for (let n = 2; taken.has(out.toLowerCase()); n++) out = name.replace(/\.mp4$/, `-${n}.mp4`);
  taken.add(out.toLowerCase());
  return out;
}

async function muxOne(ff, video, audio) {
  const inV = "in." + extOf(video.name);
  const inA = "in." + extOf(audio.name);
  const out = "out.mp4";
  await ff.writeFile(inV, await fetchFile(video));
  await ff.writeFile(inA, await fetchFile(audio));
  const code = await ff.exec([
    "-y",
    "-i",
    inV,
    "-i",
    inA,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-shortest",
    "-movflags",
    "+faststart",
    out,
  ]);
  try {
    if (code !== 0) throw new Error(`ffmpeg failed on ${video.name}`);
    const data = await ff.readFile(out);
    return new Blob([data.buffer], { type: "video/mp4" });
  } finally {
    for (const name of [inV, inA, out]) await ff.deleteFile(name).catch(() => {});
  }
}

async function run() {
  const pairs = pairFiles(videos, audios).filter((p) => p.audio);
  if (!pairs.length) return;
  loading = true;
  els.run.disabled = true;
  setError("");
  els.bar.hidden = false;
  els.bar.value = 0;
  try {
    const ff = await loadFfmpeg();
    const zip = new JSZip();
    const failed = [];
    const taken = new Set();
    let done = 0;
    for (let i = 0; i < pairs.length; i++) {
      const { video, audio } = pairs[i];
      els.status.textContent = `Muxing ${i + 1}/${pairs.length}: ${video.name}`;
      try {
        const blob = await muxOne(ff, video, audio);
        zip.file(uniqueName(outName(video.name), taken), blob);
        done += 1;
      } catch (err) {
        failed.push(video.name);
      }
    }
    if (failed.length) setError(`Could not mux: ${failed.join(", ")}.`);
    if (!done) throw new Error(`Could not mux: ${failed.join(", ")}.`);
    els.status.textContent = "Zipping…";
    const packed = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(packed);
    a.download = "wavon-mixes.zip";
    a.click();
    URL.revokeObjectURL(a.href);
    els.status.textContent = `${done} muxed file${done === 1 ? "" : "s"} · stayed in this tab`;
    els.bar.value = 100;
  } catch (err) {
    setError(err && err.message ? err.message : String(err));
  } finally {
    loading = false;
    render();
  }
}

els.pick.addEventListener("click", () => els.file.click());
els.file.addEventListener("change", () => {
  addFiles([...els.file.files]);
  els.file.value = "";
});
els.clear.addEventListener("click", () => {
  videos = [];
  audios = [];
  setError("");
  els.bar.hidden = true;
  render();
});
els.run.addEventListener("click", () => run());

["dragenter", "dragover"].forEach((ev) => {
  els.drop.addEventListener(ev, (e) => {
    e.preventDefault();
    els.drop.classList.add("over");
  });
});
els.drop.addEventListener("dragleave", () => els.drop.classList.remove("over"));
els.drop.addEventListener("drop", (e) => {
  e.preventDefault();
  els.drop.classList.remove("over");
  addFiles([...e.dataTransfer.files]);
});

render();
