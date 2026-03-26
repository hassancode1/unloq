"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// ── Swap point ────────────────────────────────────────────────────────────────
// Groq (temporary): set GROQ_API_KEY in Convex env vars
// Gemini (permanent): set GEMINI_API_KEY in Convex env vars → auto-switches
// ─────────────────────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are a document-to-course converter. Your only job is to reorganise and quote content that already exists in the document the user provides.

ABSOLUTE RULES — violating any of these is a failure:
1. Every sentence you write must come word-for-word, or very nearly word-for-word, from the document. Do not rephrase, summarise, or simplify.
2. Do not write a single explanatory sentence of your own. If the document says it, quote it. If the document does not say it, leave it out.
3. Do not add examples, analogies, context, or background knowledge that is not explicitly stated in the document.
4. Names, numbers, dates, technical terms, and definitions must appear exactly as written in the document.
5. The article body sections must be direct excerpts — copy 2–4 consecutive or thematically close sentences from the document verbatim.`;
}

function buildUserPrompt(
  lessonCount: number,
  difficulty: string,
  userPrompt?: string,
): string {
  const quizDepth =
    {
      beginner:     "Test recall of definitions and key facts stated in the document.",
      intermediate: "Test understanding of how concepts in the document relate to each other.",
      advanced:     "Test ability to apply or analyse specific claims and arguments made in the document.",
    }[difficulty] ?? "";

  const userContext = userPrompt?.trim()
    ? `Focus area from the learner: "${userPrompt.trim()}". Prioritise sections of the document most relevant to this when selecting which passages to include.\n\n`
    : "";

  return `${userContext}Structure the DOCUMENT TEXT below into exactly ${lessonCount} lessons. Each lesson covers a different section of the document in order.

For each lesson output:

CONTENT (3–5 sections): Each section = one "heading" (3–6 words, can be taken from the document) + one "body" (copy 2–4 sentences verbatim or near-verbatim from that part of the document).

FLASHCARDS (exactly 4): "front" = a term, name, or short question lifted from the document. "back" = the answer copied verbatim from the document (1–3 sentences).

QUIZ (exactly 4 questions, ${quizDepth}): Each question tests a specific fact stated in the document. One correct option (exact wording from the document), three plausible distractors.

Output ONLY valid JSON:
{
  "title": "Title taken directly from the document or its cover/header (max 8 words)",
  "description": "Copy 2–3 sentences from the document's introduction or abstract that describe what it is about.",
  "learningObjectives": ["Copied or near-verbatim goal statements from the document, or derive only from explicit document content"],
  "lessons": [
    {
      "lessonNumber": 1,
      "title": "Section title from the document",
      "keyConcept": "One sentence copied verbatim from this section that best captures its main point.",
      "content": [
        { "heading": "Heading from document", "body": "Verbatim or near-verbatim sentences from this section of the document." }
      ],
      "flashcards": [
        { "front": "Term or question from the document", "back": "Verbatim answer from the document" }
      ],
      "quiz": [
        {
          "question": "Question testing a specific fact in this section?",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correctAnswer": "Option A"
        }
      ]
    }
  ]
}`;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function callGemini(
  pdfBase64: string,
  lessonCount: number,
  difficulty: string,
  apiKey: string,
  userPrompt?: string,
): Promise<string> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
  const result = await model.generateContent([
    { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
    { text: buildSystemPrompt() + "\n\n" + buildUserPrompt(lessonCount, difficulty, userPrompt) },
  ]);
  return result.response.text().trim();
}

/** Extract readable text from a PDF buffer using only Node.js builtins (no pdfjs). */
async function extractPdfText(buffer: Buffer): Promise<string> {
  const { inflateRaw, inflate } = await import("zlib");
  const { promisify } = await import("util");
  const inflateRawAsync = promisify(inflateRaw);
  const inflateAsync = promisify(inflate);

  const raw = buffer.toString("binary");
  const texts: string[] = [];

  // Find all content streams (compressed or plain)
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;

  while ((match = streamRegex.exec(raw)) !== null) {
    const chunk = Buffer.from(match[1], "binary");
    let decoded = "";
    try {
      // Try zlib inflate (FlateDecode)
      const out = await inflateAsync(chunk).catch(() => inflateRawAsync(chunk));
      decoded = out.toString("latin1");
    } catch {
      decoded = chunk.toString("latin1");
    }

    // Tj  — single string: (text) Tj
    const tjRe = /\(([^)]*)\)\s*Tj/g;
    let m: RegExpExecArray | null;
    while ((m = tjRe.exec(decoded)) !== null) texts.push(m[1]);

    // TJ — array: [(text) -num (text)] TJ
    const tjArrRe = /\[([^\]]+)\]\s*TJ/g;
    while ((m = tjArrRe.exec(decoded)) !== null) {
      const inner = m[1];
      const strRe = /\(([^)]*)\)/g;
      let sm: RegExpExecArray | null;
      while ((sm = strRe.exec(inner)) !== null) if (sm[1].trim()) texts.push(sm[1]);
    }
  }

  return texts
    .map((t) =>
      t
        .replace(/\\n/g, " ")
        .replace(/\\r/g, " ")
        .replace(/\\(\d{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)))
        .replace(/\\\\/g, "\\"),
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Sample text evenly throughout the document so short lesson counts
 * still cover the full PDF rather than just the beginning.
 * Splits into equal-sized windows and takes a chunk from each.
 */
function sampleDocument(text: string, charLimit: number): string {
  if (text.length <= charLimit) return text;

  // Use 6 evenly-spaced windows across the document
  const windows = 6;
  const chunkSize = Math.floor(charLimit / windows);
  const step = Math.floor(text.length / windows);
  const parts: string[] = [];

  for (let i = 0; i < windows; i++) {
    const start = i * step;
    parts.push(text.slice(start, start + chunkSize));
  }

  const joined = parts.join("\n\n--- [continued] ---\n\n");
  // Strip characters that would break JSON parsing when the model echoes them back
  return joined.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\\]/g, " ").replace(/\s+/g, " ");
}

async function callGroq(
  pdfBase64: string,
  lessonCount: number,
  difficulty: string,
  apiKey: string,
  userPrompt?: string,
): Promise<string> {
  const Groq = (await import("groq-sdk")).default;

  const pdfBuffer = Buffer.from(pdfBase64, "base64");
  const docText = await extractPdfText(pdfBuffer);
  if (!docText) throw new Error("Could not extract text from PDF. Make sure it is a text-based PDF, not a scanned image.");

  // Scale how much document text we send based on lesson count:
  // fewer lessons → shorter response → more budget for document text.
  // Each lesson costs roughly 600 output tokens; llama-3.3-70b has a 32k output limit.
  const docCharLimit = Math.min(
    30000,
    Math.max(8000, Math.round(24000 / (lessonCount / 3))),
  );
  const maxOutputTokens = Math.min(32000, lessonCount * 800 + 1000);

  // Sample throughout the whole document instead of just the start,
  // so a 3-lesson course on a 200-page PDF still covers the full content.
  const sampled = sampleDocument(docText, docCharLimit);

  const groq = new Groq({ apiKey });
  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: buildSystemPrompt(),
      },
      {
        role: "user",
        content:
          buildUserPrompt(lessonCount, difficulty, userPrompt) +
          "\n\nDOCUMENT TEXT:\n" +
          sampled,
      },
    ],
    temperature: 0.3,
    max_tokens: maxOutputTokens,
  });
  return completion.choices[0]?.message?.content?.trim() ?? "";
}

export const generateCourse = action({
  args: {
    courseId: v.id("courses"),
    pdfBase64: v.string(),
    lessonCount: v.number(),
    difficulty: v.union(
      v.literal("beginner"),
      v.literal("intermediate"),
      v.literal("advanced"),
    ),
    userPrompt: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { courseId, pdfBase64, lessonCount, difficulty, userPrompt },
  ) => {
    try {
      // const geminiKey = process.env.GEMINI_API_KEY; // TODO: re-enable when billing is resolved
      const groqKey = process.env.GROQ_API_KEY;

      if (!groqKey) throw new Error("GROQ_API_KEY not set in Convex env vars.");

      let raw = await callGroq(
        pdfBase64,
        lessonCount,
        difficulty,
        groqKey,
        userPrompt,
      );

      // Strip markdown fences if present
      raw = raw
        .replace(/^```json\n?/, "")
        .replace(/^```\n?/, "")
        .replace(/```\n?$/, "")
        .trim();

      const courseData = JSON.parse(raw);

      await ctx.runMutation(api.courses.patchTitleAndDescription, {
        courseId,
        title: courseData.title ?? "Untitled Course",
        description: courseData.description ?? "",
        totalLessons: courseData.lessons?.length ?? lessonCount,
      });

      const lessons: any[] = Array.isArray(courseData.lessons)
        ? courseData.lessons
        : [];

      for (const lesson of lessons) {
        const flashcards = (lesson.flashcards ?? [])
          .filter((f: any) => f?.front && f?.back)
          .map((f: any) => ({ front: String(f.front), back: String(f.back) }));

        const quiz = (lesson.quiz ?? [])
          .filter(
            (q: any) =>
              q?.question &&
              Array.isArray(q.options) &&
              q.options.length === 4 &&
              q.correctAnswer &&
              q.options.includes(q.correctAnswer),
          )
          .map((q: any) => ({
            question: String(q.question),
            options: q.options.map(String),
            correctAnswer: String(q.correctAnswer),
          }));

        const content = Array.isArray(lesson.content)
          ? lesson.content
              .filter((s: any) => s?.heading && s?.body)
              .map((s: any) => ({ heading: String(s.heading), body: String(s.body) }))
          : undefined;

        await ctx.runMutation(api.courses.insertLesson, {
          courseId,
          lessonNumber: Number(lesson.lessonNumber) || 1,
          title: lesson.title ?? `Lesson ${lesson.lessonNumber}`,
          keyConcept: lesson.keyConcept ?? "",
          content,
          flashcards,
          quiz,
        });
      }

      await ctx.runMutation(api.courses.updateStatus, {
        courseId,
        status: "ready",
      });
    } catch (err) {
      console.error("generateCourse failed:", err);
      // Delete the course entirely so it never shows in the UI
      await ctx.runMutation(api.courses.remove, { courseId });
      throw err; // re-throw so the client catch block fires
    }
  },
});
