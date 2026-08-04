import { mkdir, writeFile } from "node:fs/promises";

const SRC =
  "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json";

const res = await fetch(SRC);
if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
await mkdir(new URL("../.cache/", import.meta.url), { recursive: true });
await writeFile(
  new URL("../.cache/exercises.json", import.meta.url),
  Buffer.from(await res.arrayBuffer()),
);
console.log("fetched exercises.json");
