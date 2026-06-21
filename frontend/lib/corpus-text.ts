/** Parse newline-separated corpus text into trimmed non-empty lines. */
export function corpusLinesToList(text: string): readonly string[] {
  return text.split(/\n/).map((line) => line.trim()).filter(Boolean);
}
