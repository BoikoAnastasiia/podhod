export type RawExercise = {
  id: string;
  name: string;
  category: string;
  body_part: string;
  equipment: string;
  muscle_group: string;
  secondary_muscles: string[];
  target: string;
  image: string;
  gif_url: string;
  media_id: string;
  created_at: string;
  attribution: string;
  instructions: Record<string, string>;
  instruction_steps: Record<string, string[]>;
};

export type SeedExercise = {
  id: string;
  name: string;
  body_part: string;
  equipment: string;
  target: string;
  muscle_group: string;
  secondary_muscles: string[];
  media_id: string;
  image: string;
  gif_url: string;
  steps_en: string[];
  steps_ru: string[];
};

/**
 * Upstream ships ten languages and a per-row copy of a constant attribution
 * string. We keep en + ru and drop the rest, which is what takes the dataset
 * from 17 MB to ~2.1 MB.
 */
export function transformExercise(raw: RawExercise): SeedExercise {
  return {
    id: raw.id,
    name: raw.name,
    body_part: raw.body_part,
    equipment: raw.equipment,
    target: raw.target,
    muscle_group: raw.muscle_group,
    secondary_muscles: raw.secondary_muscles,
    media_id: raw.media_id,
    image: raw.image,
    gif_url: raw.gif_url,
    steps_en: raw.instruction_steps.en ?? [],
    steps_ru: raw.instruction_steps.ru ?? [],
  };
}
