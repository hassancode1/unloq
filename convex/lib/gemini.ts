// Single place for the Gemini model name (a stable model, never a preview: previews
// have tight limits and get retired). Override with the GEMINI_MODEL env var
// (npx convex env set GEMINI_MODEL ...) when Google retires this one.
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";

// Cheap, fast model for the public onboarding demo grader (short JSON, one fact).
// Override with: npx convex env set GEMINI_LITE_MODEL ...
export const GEMINI_LITE_MODEL = process.env.GEMINI_LITE_MODEL ?? "gemini-3.5-flash-lite";
