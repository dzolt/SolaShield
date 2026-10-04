/** Joins class names, skipping falsy parts. */
export const cx = (...parts: readonly (string | false | null | undefined)[]): string => parts.filter(Boolean).join(" ");
