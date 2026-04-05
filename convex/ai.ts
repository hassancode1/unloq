"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";



function buildSystemPrompt(): string {
  return `You are a text organiser, not a writer. Your job is to copy text from the document and arrange it into a course structure — nothing more.

RULES (non-negotiable):
1. Every word in every article body, flashcard answer, and quiz option must come directly from the document text provided. Copy sentences as-is.
2. The only editing allowed is fixing obvious PDF extraction artifacts: joining hyphenated line-breaks (e.g. "strat-\negy" → "strategy"), removing stray page numbers or headers, and normalising whitespace.
3. Do not rephrase, simplify, explain, or add any sentence of your own. If the document uses a complex term, keep it. If the document is dense, keep it dense.
4. Do not add examples, analogies, transitions, or context that are not in the document.
5. If a section of the document doesn't have enough clean sentences to fill a body field, use whatever is there — even if it is only 1–2 sentences. Do not pad.`;
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

  return `${userContext}Structure the document into exactly ${lessonCount} lessons. You MUST use the entire document — divide it into ${lessonCount} roughly equal portions from start to finish. Every portion of the document must be represented. Do not skip or compress later sections.

For each lesson output:

CONTENT (3–5 sections): Each section = one "heading" (a phrase taken from the document, 3–6 words) + one "body" (copy 2–5 consecutive sentences from that part of the document verbatim, fixing only PDF artifacts like broken hyphenation).

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

async function callGeminiText(
  transcript: string,
  lessonCount: number,
  difficulty: string,
  apiKey: string,
  userPrompt?: string,
): Promise<string> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const result = await model.generateContent([
    {
      text:
        buildSystemPrompt() +
        "\n\n" +
        buildUserPrompt(lessonCount, difficulty, userPrompt) +
        "\n\n--- TRANSCRIPT ---\n" +
        transcript,
    },
  ]);
  return result.response.text().trim();
}

async function callGemini(
  pdfBase64: string,
  lessonCount: number,
  difficulty: string,
  apiKey: string,
  userPrompt?: string,
): Promise<string> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const result = await model.generateContent([
    { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
    { text: buildSystemPrompt() + "\n\n" + buildUserPrompt(lessonCount, difficulty, userPrompt) },
  ]);
  return result.response.text().trim();
}

async function callClaude(
  pdfBase64: string,
  lessonCount: number,
  difficulty: string,
  apiKey: string,
  userPrompt?: string,
): Promise<string> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-3-5-haiku-20241022",
    max_tokens: Math.min(8192, lessonCount * 1500 + 2000),
    system: buildSystemPrompt(),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdfBase64,
            },
          } as any,
          {
            type: "text",
            text: buildUserPrompt(lessonCount, difficulty, userPrompt),
          },
        ],
      },
    ],
  });

  const block = message.content.find((b: any) => b.type === "text");
  return (block as any)?.text?.trim() ?? "";
}

/**
 * Try to parse JSON. If it's truncated, salvage whatever complete lessons
 * were generated rather than failing entirely.
 */
function parseOrRepair(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    const lessonsStart = raw.indexOf('"lessons"');
    if (lessonsStart === -1)
      throw new Error("AI response did not contain a lessons array.");

    const arrayOpen = raw.indexOf("[", lessonsStart);
    if (arrayOpen === -1)
      throw new Error("AI response lessons array not found.");

    let depth = 0;
    let lastCompleteEnd = -1;
    for (let i = arrayOpen + 1; i < raw.length; i++) {
      const ch = raw[i];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) lastCompleteEnd = i;
      }
    }

    if (lastCompleteEnd === -1)
      throw new Error("No complete lessons found in AI response.");

    const repaired =
      raw.slice(0, arrayOpen + 1) +
      raw.slice(arrayOpen + 1, lastCompleteEnd + 1) +
      "]}";
    try {
      const result = JSON.parse(repaired);
      console.warn(
        `JSON was truncated — salvaged ${result.lessons?.length ?? 0} lessons.`,
      );
      return result;
    } catch {
      throw new Error("AI response was truncated and could not be repaired.");
    }
  }
}

export const fetchYoutubeTranscript = action({
  args: { url: v.string() },
  handler: async (_ctx, { url }): Promise<string> => {
    const { YoutubeTranscript } = await import("youtube-transcript");

    const match = url.match(
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([A-Za-z0-9_-]{11})/,
    );
    if (!match) throw new Error("Invalid YouTube URL. Paste a full YouTube link.");

    const videoId = match[1];

    let segments: { text: string }[];
    try {
      segments = await YoutubeTranscript.fetchTranscript(videoId);
    } catch (err: any) {
      const msg: string = err?.message ?? "";
      if (
        msg.includes("disabled") ||
        msg.includes("subtitles") ||
        msg.includes("transcript") ||
        msg.includes("not available")
      ) {
        throw new Error("This video has no transcript. Try a video with captions enabled.");
      }
      throw new Error(`Could not fetch transcript: ${msg}`);
    }

    if (!segments || segments.length === 0) {
      throw new Error("This video has no transcript. Try a video with captions enabled.");
    }

    const text = segments.map((s) => s.text).join(" ").trim();
    if (text.length < 200) {
      throw new Error("Transcript is too short to generate a course from. Try a longer video.");
    }

    return text;
  },
});

export const generateCourse = action({
  args: {
    courseId: v.id("courses"),
    pdfBase64: v.optional(v.string()),
    transcript: v.optional(v.string()),
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
    { courseId, pdfBase64, transcript, lessonCount, difficulty, userPrompt },
  ) => {
    try {
      const geminiKey = process.env.GEMINI_API_KEY;

      if (!geminiKey)
        throw new Error(
          "No AI API key set. Add GEMINI_API_KEY in Convex env vars.",
        );

      if (!pdfBase64 && !transcript)
        throw new Error("Either pdfBase64 or transcript must be provided.");

      let raw: string;
      if (transcript) {
        raw = await callGeminiText(transcript, lessonCount, difficulty, geminiKey, userPrompt);
      } else {
        raw = await callGemini(pdfBase64!, lessonCount, difficulty, geminiKey, userPrompt);
      }

      // Strip markdown fences if present
      raw = raw
        .replace(/^```json\n?/, "")
        .replace(/^```\n?/, "")
        .replace(/```\n?$/, "")
        .trim();

      const courseData = parseOrRepair(raw);

      await ctx.runMutation(api.courses.patchTitleAndDescription, {
        courseId,
        title: courseData.title ?? "Untitled Course",
        description: courseData.description ?? "",
        totalLessons: courseData.lessons?.length ?? lessonCount,
      });

      // Clear any lessons from a previous attempt before inserting (handles action retries)
      await ctx.runMutation(api.courses.clearLessons, { courseId });

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
              .map((s: any) => ({
                heading: String(s.heading),
                body: String(s.body),
              }))
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
      try {
        await ctx.runMutation(api.courses.updateStatus, {
          courseId,
          status: "error",
        });
        await ctx.runMutation(api.courses.remove, { courseId });
      } catch (cleanupErr) {
        console.error(
          "cleanup failed (course left as error status):",
          cleanupErr,
        );
      }
      throw err;
    }
  },
});
