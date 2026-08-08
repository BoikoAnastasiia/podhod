import {
  countResponseSchema,
  createdIdSchema,
  detailSchema,
  errorResponseSchema,
  listResponseSchema,
  meResponseSchema,
  programDetailSchema,
  programListResponseSchema,
  type CountResponse,
  type CreateProgramExerciseInput,
  type CreateProgramInput,
  type ExerciseDetail,
  type Lang,
  type ListResponse,
  type MeResponse,
  type ProgramDetail,
  type ProgramListResponse,
  type UpdateProgramInput,
} from "@podhod/schema";

async function get<T>(path: string, parse: (v: unknown) => T): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    const parsed = errorResponseSchema.safeParse(await res.json());
    const code = parsed.success ? parsed.data.error.code : `http_${res.status}`;
    throw new Error(code);
  }
  return parse(await res.json());
}

export type ExerciseFilters = {
  lang: Lang;
  q?: string;
  bodyPart?: string;
  equipment?: string;
  target?: string;
  cursor?: string;
  /** Caps the page size; omitted, the API defaults to 30. */
  limit?: number;
};

export function fetchExercises(f: ExerciseFilters): Promise<ListResponse> {
  const params = new URLSearchParams({ lang: f.lang });
  for (const key of ["q", "bodyPart", "equipment", "target", "cursor"] as const) {
    const value = f[key];
    if (value) params.set(key, value);
  }
  if (f.limit) params.set("limit", String(f.limit));
  return get(`/api/exercises?${params}`, (v) => listResponseSchema.parse(v));
}

export function fetchExercise(id: string, lang: Lang): Promise<ExerciseDetail> {
  return get(`/api/exercises/${id}?lang=${lang}`, (v) => detailSchema.parse(v));
}

/**
 * The whole library's size, independent of any filter — what the landing
 * page proves is real rather than a hard-coded "1,324" that drifts the
 * moment the dataset is re-seeded.
 */
export function fetchExerciseCount(): Promise<CountResponse> {
  return get("/api/exercises/count", (v) => countResponseSchema.parse(v));
}

/**
 * The one protected read this phase ships. Cookies ride along automatically
 * — same-origin requests send them without `credentials: "include"` — so a
 * signed-out caller simply gets the shared 401 envelope `get()` already
 * turns into a thrown `Error("unauthorized")`.
 */
export function fetchMe(): Promise<MeResponse> {
  return get("/api/me", (v) => meResponseSchema.parse(v));
}

/**
 * Writes return either 201 with a small body or 204 with none, so this cannot
 * unconditionally parse JSON: `res.json()` on an empty body throws a
 * SyntaxError, which would surface to the caller as a failed mutation on a
 * request that actually succeeded.
 */
async function send<T>(
  method: string,
  path: string,
  body?: unknown,
  parse?: (v: unknown) => T,
): Promise<T | undefined> {
  const res = await fetch(path, {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!res.ok) {
    const parsed = errorResponseSchema.safeParse(await res.json().catch(() => null));
    throw new Error(parsed.success ? parsed.data.error.code : `http_${res.status}`);
  }
  if (res.status === 204) return undefined;
  const json: unknown = await res.json();
  return parse ? parse(json) : (json as T);
}

/** Every create returns the new row's id and nothing else. */
const createdId = (v: unknown): string => createdIdSchema.parse(v).id;

export function fetchPrograms(): Promise<ProgramListResponse> {
  return get("/api/programs", (v) => programListResponseSchema.parse(v));
}

/**
 * `lang` is part of the request because a program's exercise names come from
 * the library join — the program itself stores no names.
 */
export function fetchProgram(id: string, lang: Lang): Promise<ProgramDetail> {
  return get(`/api/programs/${id}?lang=${lang}`, (v) => programDetailSchema.parse(v));
}

export function createProgram(input: CreateProgramInput): Promise<string | undefined> {
  return send("POST", "/api/programs", input, createdId);
}

export function updateProgram(id: string, input: UpdateProgramInput): Promise<void> {
  return send("PATCH", `/api/programs/${id}`, input).then(() => undefined);
}

export function deleteProgram(id: string): Promise<void> {
  return send("DELETE", `/api/programs/${id}`).then(() => undefined);
}

export function addExercise(
  programId: string,
  input: CreateProgramExerciseInput,
): Promise<string | undefined> {
  return send("POST", `/api/programs/${programId}/exercises`, input, createdId);
}

export function updateExercise(
  entryId: string,
  input: { scheme?: unknown; restSeconds?: number | null; notes?: string | null },
): Promise<void> {
  return send("PATCH", `/api/programs/exercises/${entryId}`, input).then(() => undefined);
}

export function deleteExercise(entryId: string): Promise<void> {
  return send("DELETE", `/api/programs/exercises/${entryId}`).then(() => undefined);
}

/**
 * The complete ordered list, not a from/to pair — the API validates the set
 * before writing, so a partial list is refused rather than half-applied.
 */
export function reorderExercises(programId: string, ids: string[]): Promise<void> {
  return send("PUT", `/api/programs/${programId}/exercises/order`, { ids }).then(
    () => undefined,
  );
}
