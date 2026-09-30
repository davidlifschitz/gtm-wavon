import { it, expect } from "vitest";
import { boot, f, add, runAndZip, zipNames } from "./setup.js";

it("pairs videos with mixes by name, ignoring mix/final/v2 words", async () => {
  const { mod } = await boot();
  const pairs = mod.pairFiles([f("Ep 1.mov"), f("ep_2.mp4")], [f("EP2 final mix.wav"), f("ep 1 v3.wav")]);
  expect(pairs.map((p) => [p.video.name, p.audio?.name])).toEqual([
    ["Ep 1.mov", "ep 1 v3.wav"],
    ["ep_2.mp4", "EP2 final mix.wav"],
  ]);
});

it("shows pairs and unmatched videos", async () => {
  const { $ } = await boot();
  add([f("a.mp4"), f("b.mp4"), f("a.wav")]);
  expect($("status").textContent).toContain("2 videos · 1 mix · 1 pair");
  expect($("pairs").textContent).toContain("no matching mix");
});

it("copies video, encodes the mix to AAC, and zips -mix.mp4 files", async () => {
  const { $, out, calls } = await boot();
  add([f("a.mov"), f("a.wav"), f("b.mp4"), f("b.wav")]);
  await runAndZip();
  expect($("error").textContent).toBe("");
  expect(calls).toHaveLength(2);
  const args = calls[0].args.join(" ");
  expect(args).toContain("-map 0:v:0 -map 1:a:0 -c:v copy -c:a aac");
  expect(await zipNames(out.at(-1))).toEqual(["a-mix.mp4", "b-mix.mp4"]);
});
