import { it, expect } from "vitest";
import { boot, f, add } from "./setup.js";

it("labels controls and announces status and errors", async () => {
  const { $ } = await boot();
  expect($("file").getAttribute("aria-label")).toBeTruthy();
  expect($("bar").getAttribute("aria-label")).toBeTruthy();
  expect($("status").getAttribute("role")).toBe("status");
  expect($("error").getAttribute("role")).toBe("alert");
  add([f("a.mp4"), f("a.wav"), f("b.mp4")]);
  expect($("pairs").getAttribute("role")).toBe("list");
  expect($("pairs").querySelectorAll('[role="listitem"]')).toHaveLength(2);
});
