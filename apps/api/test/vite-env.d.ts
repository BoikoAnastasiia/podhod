/**
 * Vite's `import.meta.glob`, narrowed to the one form the test helpers use:
 * eager, `?raw`, default import — which yields plain file contents as strings.
 *
 * Declared by hand rather than pulled in via `vite/client`, since `vite` is not
 * a direct dependency of this package and its client types also declare a pile
 * of browser-only asset modules that have no place in a Worker.
 */
interface ImportMeta {
  glob(
    pattern: string,
    options: { query: "?raw"; import: "default"; eager: true },
  ): Record<string, string>;
}
