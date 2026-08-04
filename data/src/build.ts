import { readFile, writeFile } from "node:fs/promises";
import { transformExercise, type RawExercise } from "./transform.js";

const raw: RawExercise[] = JSON.parse(
  await readFile(new URL("../.cache/exercises.json", import.meta.url), "utf8"),
);
const seed = raw.map(transformExercise);
const out = new URL("../exercises.seed.json", import.meta.url);
await writeFile(out, JSON.stringify(seed));
console.log(`wrote ${seed.length} exercises`);
