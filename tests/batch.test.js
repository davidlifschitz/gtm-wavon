import { it, expect } from "vitest";
import { boot, f, add, zipNames } from "./setup.js";
import { vi } from "vitest";

async function run($) {
  $("run").click();
  await vi.waitFor(() => { if ($("run").disabled) throw new Error("running"); });
}

it("keeps going when one video fails and says which one", async () => {
  const { $, out, calls, fail } = await boot();
  fail.add("b.mp4");
  add([f("a.mp4"), f("a.wav"), f("b.mp4"), f("b.wav"), f("c.mp4"), f("c.wav")]);
  await run($);
  expect(calls).toHaveLength(3);
  expect(await zipNames(out.at(-1))).toEqual(["a-mix.mp4", "c-mix.mp4"]);
  expect($("error").textContent).toContain("b.mp4");
});

it("always overwrites ffmpeg's output so a leftover file can't stall the next run", async () => {
  const { $, calls } = await boot();
  add([f("a.mp4"), f("a.wav")]);
  await run($);
  expect(calls[0].args[0]).toBe("-y");
});
