import { maskSubjectId } from "@/logger";

const SUBJECT_KEY_PATTERN = /subject/i;

export const sanitizeStructuredContent = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sanitizeStructuredContent);
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>(
      (acc, [key, entry]) => {
        if (typeof entry === "string" && SUBJECT_KEY_PATTERN.test(key)) {
          acc[key] = maskSubjectId(entry);
          return acc;
        }
        acc[key] = sanitizeStructuredContent(entry);
        return acc;
      },
      {}
    );
  }
  return value;
};
