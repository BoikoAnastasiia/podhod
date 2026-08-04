/**
 * Media is © Gym visual, redistributed by the upstream dataset under a separate
 * permission that does not extend to us. It must stay at 180×180 and carry this
 * attribution wherever it is displayed.
 */
export const ATTRIBUTION = "© Gym visual — https://gymvisual.com/";

const DEFAULT_MEDIA_BASE =
  "https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main";

/** One env var away from pointing at R2 if the media is ever licensed directly. */
export function mediaUrl(path: string, base = DEFAULT_MEDIA_BASE): string {
  return `${base}/${path}`;
}
