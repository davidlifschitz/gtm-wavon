import { readFileSync } from "node:fs";
import { join } from "node:path";
import { vi } from "vitest";
import JSZip from "jszip";
import { calls, fail } from "./fake-ffmpeg.js";

function readBlob(b, how) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r[how](b);
  });
}
Blob.prototype.arrayBuffer ??= function () { return readBlob(this, "readAsArrayBuffer"); };

export async function boot() {
  const html = readFileSync(join(__dirname, "../index.html"), "utf8");
  document.body.innerHTML = html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g, "");
  const out = [];
  URL.createObjectURL = (b) => (out.push(b), "blob:x");
  URL.revokeObjectURL = () => {};
  HTMLAnchorElement.prototype.click = function () {};
  globalThis.JSZip = JSZip;
  calls.length = 0;
  fail.clear();
  vi.resetModules();
  const mod = await import("../app.js");
  return { mod, out, calls, fail, $: (id) => document.getElementById(id) };
}

export const f = (name, type = "") => new File(["x"], name, { type });

export function add(files) {
  const input = document.getElementById("file");
  Object.defineProperty(input, "files", { value: files, configurable: true });
  input.dispatchEvent(new Event("change"));
}

export async function runAndZip() {
  document.getElementById("run").click();
  await vi.waitFor(() => {
    if (document.getElementById("run").disabled && !document.getElementById("error").textContent) throw new Error("running");
  });
}

export async function zipNames(blob) {
  return Object.keys((await JSZip.loadAsync(await blob.arrayBuffer())).files).sort();
}
