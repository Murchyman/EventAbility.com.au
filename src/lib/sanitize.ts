import DOMPurify from "isomorphic-dompurify";

export function sanitizeInput(input: string | null | undefined): string {
  if (!input) return "";
  // Remove any HTML tags and encode special characters
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // Remove all HTML tags
    ALLOWED_ATTR: [], // Remove all attributes
  }).trim();
}

export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      sanitized[key] = sanitizeInput(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized as T;
}
