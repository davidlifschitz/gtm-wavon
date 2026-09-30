import { it, expect, vi } from "vitest";
import { boot, f, add, zipNames } from "./setup.js";

it("gives each output its own name when videos share a base name", async () => {
  const { $, out } = await boot();
  add([f("take.mov"), f("take.mp4"), f("take.wav"), f("take mix.wav")]);
  $("run").click();
  await vi.waitFor(() => { if ($("run").disabled) throw new Error("running"); });
  expect(await zipNames(out.at(-1))).toEqual(["take-mix-2.mp4", "take-mix.mp4"]);
});

it("lists every skipped file, not just the last one", async () => {
  const { $ } = await boot();
  const big = f("huge.mov");
  Object.defineProperty(big, "size", { value: 81 * 1024 * 1024 });
  add([big, f("notes.txt"), f("a.mp4")]);
  const msg = $("error").textContent;
  expect(msg).toContain("huge.mov");
  expect(msg).toContain("notes.txt");
});
