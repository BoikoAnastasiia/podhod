import {
  detailSchema,
  errorResponseSchema,
  listResponseSchema,
  type ExerciseDetail,
  type Lang,
  type ListResponse,
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
};

export function fetchExercises(f: ExerciseFilters): Promise<ListResponse> {
  const params = new URLSearchParams({ lang: f.lang });
  for (const key of ["q", "bodyPart", "equipment", "target", "cursor"] as const) {
    const value = f[key];
    if (value) params.set(key, value);
  }
  return get(`/api/exercises?${params}`, (v) => listResponseSchema.parse(v));
}

export function fetchExercise(id: string, lang: Lang): Promise<ExerciseDetail> {
  return get(`/api/exercises/${id}?lang=${lang}`, (v) => detailSchema.parse(v));
}
