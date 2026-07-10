/** Maimemo tag: word is repeatedly forgotten. */
export function hasStickingTag(tags: string[] | undefined | null): boolean {
  return Boolean(tags?.includes("STICKING"))
}
