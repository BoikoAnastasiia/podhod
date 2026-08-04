import { readFile, writeFile } from "node:fs/promises";
import { buildRows, toSql } from "./seed.js";

const read = async (p: string) =>
  JSON.parse(await readFile(new URL(p, import.meta.url), "utf8"));

const sql = toSql(
  buildRows(
    await read("../../../data/exercises.seed.json"),
    await read("../../../data/taxonomy.ru.json"),
  ),
);
await writeFile(new URL("../seed.sql", import.meta.url), sql);
console.log("wrote seed.sql");
