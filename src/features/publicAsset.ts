/** Resolve bundled public files for both root hosting and GitHub Pages. */
export const publicAsset = (path: string) =>
  `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
