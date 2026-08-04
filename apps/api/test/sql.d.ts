/** Vite's `?raw` suffix hands back the file's text. */
declare module "*.sql?raw" {
  const contents: string;
  export default contents;
}
