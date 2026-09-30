// Shared through globalThis: vi.resetModules() gives app.js a fresh copy of this module.
export const calls = (globalThis.__ffCalls ??= []);
export const fail = (globalThis.__ffFail ??= new Set()); // video names whose exec should fail

export class FFmpeg {
  constructor() { this.files = new Map(); }
  on() {}
  async load() {}
  async writeFile(name, data) { this.files.set(name, data); }
  async exec(args) {
    const src = this.files.get(args[1]);
    calls.push({ args, video: src?.name });
    return fail.has(src?.name) ? 1 : 0;
  }
  async readFile() { return new Uint8Array([1, 2, 3]); }
  async deleteFile(name) { this.files.delete(name); }
}
// fetchFile just hands the File through so exec() can see which video it got.
export const fetchFile = async (f) => f;
export const toBlobURL = async (u) => u;
