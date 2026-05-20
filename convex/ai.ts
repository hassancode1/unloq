"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { type Id } from "./_generated/dataModel";



// ── Generic (user-uploaded document) prompts ─────────────────────────────────

function buildSystemPrompt(): string {
  return `You are a course organiser. Your job is to read the document and arrange its content into a course structure.

RULES (non-negotiable):
1. All content must be closely based on the document — stay faithful to the source material, its terminology, and its ideas.
2. You may paraphrase slightly to aid clarity, but do not add information, examples, or context that are not in the document.
3. Preserve technical terms and domain-specific language exactly as used in the document.
4. Do not add your own examples, analogies, or transitions not grounded in the document.
5. If a section of the document doesn't have enough content to fill a body field, use whatever is there — even if it is only 1–2 sentences. Do not pad.`;
}

function buildUserPrompt(
  lessonCount: number,
  difficulty: string,
  userPrompt?: string,
  includeFlashcards = true,
  includeQuiz = true,
  includeDiagram = false,
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

  const flashcardsInstruction = includeFlashcards
    ? `\nFLASHCARDS (exactly 4): "front" = a key term, concept, or short question from the document. "back" = the answer based on the document (1–3 sentences).`
    : "";

  const quizInstruction = includeQuiz
    ? `\nQUIZ (exactly 4 questions, ${quizDepth}): Each question tests a specific fact from the document. One correct option, three plausible distractors.`
    : "";

  const diagramInstruction = includeDiagram
    ? `\nDIAGRAM (mind map): A single object representing this lesson as a tree. "root" = the lesson title or key concept (one short phrase). "branches" = 3–5 subtopics, each with "name" (key phrase from the document) and "points" (2–3 short bullet strings based on the document).`
    : "";

  const flashcardsJson = includeFlashcards
    ? `\n      "flashcards": [\n        { "front": "Key term or question from the document", "back": "Answer based on the document" }\n      ],`
    : "";

  const quizJson = includeQuiz
    ? `\n      "quiz": [\n        {\n          "question": "Question testing a specific fact in this section?",\n          "options": ["Option A", "Option B", "Option C", "Option D"],\n          "correctAnswer": "Option A"\n        }\n      ],`
    : "";

  const diagramJson = includeDiagram
    ? `\n      "diagram": {\n        "root": "Lesson key concept phrase",\n        "branches": [\n          { "name": "Subtopic name", "points": ["Point A", "Point B"] }\n        ]\n      },`
    : "";

  return `${userContext}Structure the document into exactly ${lessonCount} lessons. You MUST use the entire document — divide it into ${lessonCount} roughly equal portions from start to finish. Every portion of the document must be represented. Do not skip or compress later sections.

For each lesson output:

CONTENT (3–5 sections): Each section = one "heading" (a key phrase from that part of the document, 3–6 words) + one "body" (2–5 sentences closely based on that part of the document, preserving its key ideas and terminology).
${flashcardsInstruction}${quizInstruction}${diagramInstruction}

Output ONLY valid JSON:
{
  "title": "Title based on the document's topic or cover/header (max 8 words)",
  "description": "2–3 sentences describing what this document is about, based on its introduction or abstract.",
  "learningObjectives": ["Learning goals derived from the document's content"],
  "lessons": [
    {
      "lessonNumber": 1,
      "title": "Section title based on the document",
      "keyConcept": "The main point of this section in one sentence.",
      "content": [
        { "heading": "Key topic from this section", "body": "Explanation closely based on this section of the document, preserving its key ideas and terminology." }
      ],${flashcardsJson}${quizJson}${diagramJson}
    }
  ]
}`;
}

// ── Exam prep prompts (admin-generated courses) ───────────────────────────────

function buildExamSystemPrompt(difficulty: string): string {
  const depthNote = {
    beginner:     "Focus on defining rules clearly and testing straightforward recall. Avoid edge cases.",
    intermediate: "Cover the rule, its elements, key exceptions, and common exam traps. Questions should require applying the rule to a simple fact pattern.",
    advanced:     "Emphasise nuanced distinctions, split-jurisdiction rules, minority vs. majority positions, and complex fact patterns that turn on a single element.",
  }[difficulty] ?? "";

  return `You are an expert bar exam and professional licensing exam instructor with 20+ years of experience writing MBE, MEE, USMLE, and similar standardised exam prep content.

Your job is to create a structured, exam-focused course on the given topic. You write authoritative, precise content — not generic summaries.

CONTENT RULES:
- State rules as black-letter law: clear, testable sentences a student can memorise and apply.
- Each content section must teach ONE concept: the rule, its elements, how it applies, and one illustrative scenario.
- Do NOT pad with obvious filler. Every sentence must add testable information.
- ${depthNote}

FLASHCARD RULES:
- Front: a one-sentence prompt that forces rule recall (e.g. "What are the elements of common law battery?", "Rule: Promissory estoppel requires...")
- Back: the complete black-letter rule or definition, stated precisely enough to earn points on an exam.
- Include at least one flashcard per key rule in the lesson.

QUIZ RULES:
- Every question MUST be a fact-pattern scenario (2–4 sentences), not a bare "what is X?" question.
- Write in the style of an actual MBE/USMLE question: a concrete client situation that requires applying the rule.
- Four answer choices: one clearly correct, three plausible but wrong (based on common misconceptions or similar rules).
- The correct answer must be unambiguously correct under the majority rule / controlling standard unless the topic specifically concerns minority positions.
- Do NOT reveal the correct answer in the question wording.`;
}

function buildExamUserPrompt(
  topic: string,
  lessonCount: number,
  difficulty: string,
  userPrompt?: string,
  includeFlashcards = true,
  includeQuiz = true,
  includeDiagram = false,
): string {
  const extra = userPrompt?.trim()
    ? `\n\nAdditional focus from the course creator: "${userPrompt.trim()}". Prioritise sub-topics most relevant to this instruction.`
    : "";

  const flashcardsInstruction = includeFlashcards
    ? "\n\nFLASHCARDS (exactly 4): Front = rule-recall prompt. Back = the complete black-letter rule, stated precisely."
    : "";

  const quizInstruction = includeQuiz
    ? "\n\nQUIZ (exactly 4 questions): Each question = a fact-pattern scenario. One correct answer, three plausible distractors based on common exam mistakes."
    : "";

  const diagramInstruction = includeDiagram
    ? "\n\nDIAGRAM (mind map): A single object representing this lesson as a tree. \"root\" = the lesson title or key concept (one short phrase). \"branches\" = 3–5 subtopics, each with \"name\" (phrase) and \"points\" (2–3 short bullet strings summarising the key rule or fact)."
    : "";

  const flashcardsJson = includeFlashcards
    ? `\n      "flashcards": [\n        { "front": "What are the elements of [rule]?", "back": "Complete black-letter rule: element 1; element 2; element 3." }\n      ],`
    : "";

  const quizJson = includeQuiz
    ? `\n      "quiz": [\n        {\n          "question": "Paula was walking on a public sidewalk when David, intending to frighten her, swung his fist within inches of her face. Paula saw the fist coming and flinched. Which of the following best describes David's liability?",\n          "options": [\n            "David is liable for assault because Paula experienced a reasonable apprehension of immediate harmful contact.",\n            "David is not liable because he did not intend to make contact.",\n            "David is liable for battery because his act was intentional.",\n            "David is not liable because no contact occurred."\n          ],\n          "correctAnswer": "David is liable for assault because Paula experienced a reasonable apprehension of immediate harmful contact."\n        }\n      ],`
    : "";

  const diagramJson = includeDiagram
    ? `\n      "diagram": {\n        "root": "Lesson key concept phrase",\n        "branches": [\n          { "name": "Subtopic name", "points": ["Point A", "Point B"] }\n        ]\n      },`
    : "";

  return `Create an exam prep course on: "${topic}"${extra}

Divide the topic into exactly ${lessonCount} lessons that together give comprehensive coverage. Progress logically — foundational rules first, then applications, then exceptions and edge cases.

For each lesson:

CONTENT (3–5 sections): Each section = one "heading" (the specific rule or sub-topic, 3–7 words) + one "body" (3–5 sentences: state the rule precisely, explain when it applies, give a one-sentence illustrative scenario).
${flashcardsInstruction}${quizInstruction}${diagramInstruction}

Output ONLY valid JSON — no markdown fences, no explanation:
{
  "title": "Concise course title (max 8 words)",
  "description": "2–3 sentences describing what this course covers and what the student will be able to do on exam day.",
  "learningObjectives": [
    "Identify and apply the rule of...",
    "Distinguish between X and Y in a fact pattern...",
    "Recognise the exception to... and when it controls"
  ],
  "lessons": [
    {
      "lessonNumber": 1,
      "title": "Specific rule or sub-topic title",
      "keyConcept": "The single most important sentence a student must remember from this lesson.",
      "content": [
        { "heading": "Rule name or sub-topic", "body": "Black-letter rule stated precisely. Explanation of when it applies. One-sentence scenario illustrating the rule." }
      ],${flashcardsJson}${quizJson}${diagramJson}
    }
  ]
}`;
}

// ── Retry wrapper for transient Gemini 503 errors ────────────────────────────

async function withGeminiRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const msg: string = err?.message ?? "";
      const isRetryable =
        msg.includes("Your request couldn't be completed") ||
        msg.includes("503") ||
        msg.includes("overloaded") ||
        msg.includes("UNAVAILABLE") ||
        msg.includes("Resource has been exhausted") ||
        msg.includes("Try again later");
      if (!isRetryable || attempt === maxAttempts) throw err;
      // Exponential backoff: 2s, 4s
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  throw lastErr;
}

// ── Exam prep generation from topic knowledge (no document) ───────────────────

async function callGeminiExamTopic(
  topic: string,
  lessonCount: number,
  difficulty: string,
  apiKey: string,
  userPrompt?: string,
  includeFlashcards = true,
  includeQuiz = true,
  includeDiagram = false,
): Promise<string> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  return withGeminiRetry(async () => {
    const result = await model.generateContent({
      contents: [{
        role: "user",
        parts: [{ text:
          buildExamSystemPrompt(difficulty) +
          "\n\n" +
          buildExamUserPrompt(topic, lessonCount, difficulty, userPrompt, includeFlashcards, includeQuiz, includeDiagram),
        }],
      }],
      generationConfig: {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
      } as any,
    });
    return result.response.text().trim();
  });
}

// ── Exam prep generation from a PDF document ──────────────────────────────────

async function callGeminiExamPdf(
  pdfBase64: string,
  topic: string,
  lessonCount: number,
  difficulty: string,
  apiKey: string,
  userPrompt?: string,
  includeFlashcards = true,
  includeQuiz = true,
  includeDiagram = false,
): Promise<string> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  return withGeminiRetry(async () => {
    const result = await model.generateContent({
      contents: [{
        role: "user",
        parts: [
          { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
          { text:
            buildExamSystemPrompt(difficulty) +
            "\n\nThe document above is the source material for this course. Base ALL content strictly on this document — do not add rules or cases not present in it.\n\n" +
            buildExamUserPrompt(topic, lessonCount, difficulty, userPrompt, includeFlashcards, includeQuiz, includeDiagram),
          },
        ],
      }],
      generationConfig: {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
      } as any,
    });
    return result.response.text().trim();
  });
}

async function callGeminiText(
  transcript: string,
  lessonCount: number,
  difficulty: string,
  apiKey: string,
  userPrompt?: string,
  includeFlashcards = true,
  includeQuiz = true,
  includeDiagram = false,
): Promise<string> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  return withGeminiRetry(async () => {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text:
        buildSystemPrompt() +
        "\n\n" +
        buildUserPrompt(lessonCount, difficulty, userPrompt, includeFlashcards, includeQuiz, includeDiagram) +
        "\n\n--- TRANSCRIPT ---\n" +
        transcript,
      }] }],
      generationConfig: {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
      } as any,
    });
    return result.response.text().trim();
  });
}

async function callGeminiVideo(
  youtubeUrl: string,
  lessonCount: number,
  difficulty: string,
  apiKey: string,
  userPrompt?: string,
  includeFlashcards = true,
  includeQuiz = true,
  includeDiagram = false,
): Promise<string> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(apiKey);

  // gemini-1.5-pro supports YouTube URL via fileData
  return withGeminiRetry(async () => {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [
          { fileData: { mimeType: "video/mp4", fileUri: youtubeUrl } },
          { text: buildSystemPrompt() + "\n\n" + buildUserPrompt(lessonCount, difficulty, userPrompt, includeFlashcards, includeQuiz, includeDiagram) },
        ]}],
        generationConfig: { responseMimeType: "application/json" },
      });
      return result.response.text().trim();
    } catch {
      // Fallback: ask Gemini to generate from its knowledge of the video URL
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text:
          "You are given a YouTube video URL. Use your knowledge of the video's content to generate a structured course.\n\n" +
          `YouTube URL: ${youtubeUrl}\n\n` +
          buildSystemPrompt() +
          "\n\n" +
          buildUserPrompt(lessonCount, difficulty, userPrompt, includeFlashcards, includeQuiz, includeDiagram),
        }] }],
        generationConfig: { responseMimeType: "application/json" },
      });
      return result.response.text().trim();
    }
  });
}

async function callGeminiImage(
  imageBase64: string,
  lessonCount: number,
  difficulty: string,
  apiKey: string,
  userPrompt?: string,
  includeFlashcards = true,
  includeQuiz = true,
  includeDiagram = false,
): Promise<string> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  return withGeminiRetry(async () => {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [
        { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
        { text:
          "The image above contains text, notes, or educational content. Read everything visible in the image carefully.\n\n" +
          buildSystemPrompt() + "\n\n" +
          buildUserPrompt(lessonCount, difficulty, userPrompt, includeFlashcards, includeQuiz, includeDiagram)
        },
      ]}],
      generationConfig: {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
      } as any,
    });
    return result.response.text().trim();
  });
}

async function callGemini(
  pdfBase64: string,
  lessonCount: number,
  difficulty: string,
  apiKey: string,
  userPrompt?: string,
  includeFlashcards = true,
  includeQuiz = true,
  includeDiagram = false,
): Promise<string> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  return withGeminiRetry(async () => {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [
        { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
        { text: buildSystemPrompt() + "\n\n" + buildUserPrompt(lessonCount, difficulty, userPrompt, includeFlashcards, includeQuiz, includeDiagram) },
      ]}],
      generationConfig: {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
      } as any,
    });
    return result.response.text().trim();
  });
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

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)));
}

function parseTranscriptXml(xml: string): string[] {
  const texts: string[] = [];
  // New format: <p t="..." d="..."><s>word</s></p>
  for (const pm of xml.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)) {
    let text = "";
    for (const sm of pm[1].matchAll(/<s[^>]*>([^<]*)<\/s>/g)) text += sm[1];
    if (!text) text = pm[1].replace(/<[^>]+>/g, "");
    const clean = decodeXmlEntities(text).trim();
    if (clean) texts.push(clean);
  }
  // Old format: <text start="..." dur="...">...</text>
  if (texts.length === 0) {
    for (const tm of xml.matchAll(/<text[^>]*>([^<]*)<\/text>/g)) {
      const clean = decodeXmlEntities(tm[1]).trim();
      if (clean) texts.push(clean);
    }
  }
  return texts;
}

const YT_API_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";

async function fetchCaptionTracks(videoId: string): Promise<any[]> {
  const clients = [
    {
      name: "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
      version: "2.0",
      ua: "Mozilla/5.0 (PlayStation 4 3.11) AppleWebKit/537.73 (KHTML, like Gecko)",
    },
    {
      name: "WEB",
      version: "2.20240101.00.00",
      ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    {
      name: "ANDROID",
      version: "20.10.38",
      ua: "com.google.android.youtube/20.10.38 (Linux; U; Android 14)",
    },
  ];

  for (const client of clients) {
    try {
      const res = await fetch(
        `https://www.youtube.com/youtubei/v1/player?key=${YT_API_KEY}&prettyPrint=false`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "User-Agent": client.ua },
          body: JSON.stringify({
            context: { client: { clientName: client.name, clientVersion: client.version } },
            videoId,
          }),
        }
      );
      const data = await res.json();
      const tracks: any[] = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
      if (tracks.length > 0) return tracks;
    } catch {
      // try next client
    }
  }

  // Final fallback: scrape the watch page
  const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
  });
  const html = await pageRes.text();
  const marker = '"captions":';
  const idx = html.indexOf(marker);
  if (idx !== -1) {
    try {
      // Extract the captions JSON object
      let depth = 0, start = idx + marker.length, end = start;
      for (; end < html.length; end++) {
        if (html[end] === '{') depth++;
        else if (html[end] === '}') { depth--; if (depth === 0) { end++; break; } }
      }
      const captionsObj = JSON.parse(html.slice(start, end));
      const tracks = captionsObj?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
      if (tracks.length > 0) return tracks;
    } catch { /* fall through */ }
  }

  return [];
}

async function getYouTubeTranscript(videoId: string): Promise<string> {
  const tracks = await fetchCaptionTracks(videoId);

  if (tracks.length === 0) {
    throw new Error("This video has no transcript. Try a video with captions enabled.");
  }

  const track = tracks.find((t: any) => t.languageCode?.startsWith("en")) ?? tracks[0];
  const captionRes = await fetch(track.baseUrl);
  const xml = await captionRes.text();
  const texts = parseTranscriptXml(xml);

  if (texts.length === 0) {
    throw new Error("This video has no transcript. Try a video with captions enabled.");
  }

  const result = texts.join(" ").trim();
  if (result.length < 200) {
    throw new Error("Transcript is too short to generate a course from. Try a longer video.");
  }
  return result;
}

export const fetchYoutubeTranscript = action({
  args: { url: v.string() },
  handler: async (_ctx, { url }): Promise<string> => {
    const trimmed = url.trim();
    const match = trimmed.match(
      /(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/))([A-Za-z0-9_-]{11})/,
    );
    if (!match) throw new Error("Invalid YouTube URL. Paste a full YouTube link.");

    return getYouTubeTranscript(match[1]);
  },
});

// ── Admin-facing course generation (called from the admin dashboard) ──────────

export const adminGenerateCourse = action({
  args: {
    course_topic: v.string(),
    lesson_count: v.number(),
    difficulty: v.union(
      v.literal("Beginner"),
      v.literal("Intermediate"),
      v.literal("Advanced"),
    ),
    prompt: v.optional(v.string()),
    group_id: v.optional(v.id("groups")),
    pdfStorageId: v.optional(v.id("_storage")),
    includeFlashcards: v.optional(v.boolean()),
    includeQuiz: v.optional(v.boolean()),
    includeDiagram: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const isAdmin = await ctx.runQuery(api.users.isAdmin, {});
    if (!isAdmin) throw new Error("Not authorized");

    const difficultyLower = args.difficulty.toLowerCase() as "beginner" | "intermediate" | "advanced";
    const includeFlashcards = args.includeFlashcards !== false;
    const includeQuiz       = args.includeQuiz !== false;
    const includeDiagram    = args.includeDiagram === true;

    // Create the course record
    const courseId: Id<"courses"> = await ctx.runMutation(api.courses.create, {
      title: args.course_topic,
      description: "",
      docName: args.course_topic,
      totalLessons: args.lesson_count,
      difficulty: difficultyLower,
      sourceType: args.pdfStorageId ? "pdf" : undefined,
    });

    // Patch admin-specific fields
    await ctx.runMutation(api.courses.updateCourse, {
      id: courseId,
      adminCreated: true,
      published: false,
      group_id: args.group_id ?? null,
      course_topic: args.course_topic,
    } as any);

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) throw new Error("No AI API key set. Add GEMINI_API_KEY in Convex env vars.");

    try {
      let raw: string;

      if (args.pdfStorageId) {
        // PDF uploaded: extract and generate exam content from it
        const blob = await ctx.storage.get(args.pdfStorageId);
        if (!blob) throw new Error("PDF not found in storage.");
        const arrayBuffer = await blob.arrayBuffer();
        const pdfBase64 = Buffer.from(arrayBuffer).toString('base64');
        raw = await callGeminiExamPdf(pdfBase64, args.course_topic, args.lesson_count, difficultyLower, geminiKey, args.prompt, includeFlashcards, includeQuiz, includeDiagram);
      } else {
        // No PDF: generate exam prep content from AI knowledge on the topic
        raw = await callGeminiExamTopic(args.course_topic, args.lesson_count, difficultyLower, geminiKey, args.prompt, includeFlashcards, includeQuiz, includeDiagram);
      }

      raw = raw.replace(/^```json\n?/, "").replace(/^```\n?/, "").replace(/```\n?$/, "").trim();
      const courseData = parseOrRepair(raw);

      await ctx.runMutation(internal.courses.patchTitleAndDescription, {
        courseId,
        title: courseData.title ?? args.course_topic,
        description: courseData.description ?? "",
        totalLessons: courseData.lessons?.length ?? args.lesson_count,
      });

      await ctx.runMutation(internal.courses.clearLessons, { courseId });

      const lessons: any[] = Array.isArray(courseData.lessons) ? courseData.lessons : [];
      for (const lesson of lessons) {
        const flashcards = (lesson.flashcards ?? [])
          .filter((f: any) => f?.front && f?.back)
          .map((f: any) => ({ front: String(f.front), back: String(f.back) }));

        const quiz = (lesson.quiz ?? [])
          .filter((q: any) =>
            q?.question && Array.isArray(q.options) && q.options.length === 4 &&
            q.correctAnswer && q.options.includes(q.correctAnswer),
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

        const diagram =
          lesson.diagram?.root && Array.isArray(lesson.diagram?.branches)
            ? {
                root: String(lesson.diagram.root),
                branches: (lesson.diagram.branches as any[])
                  .filter((b: any) => b?.name && Array.isArray(b.points))
                  .map((b: any) => ({
                    name: String(b.name),
                    points: (b.points as any[]).map(String),
                  })),
              }
            : undefined;

        await ctx.runMutation(internal.courses.insertLesson, {
          courseId,
          lessonNumber: Number(lesson.lessonNumber) || 1,
          title: lesson.title ?? `Lesson ${lesson.lessonNumber}`,
          keyConcept: lesson.keyConcept ?? "",
          content,
          flashcards,
          quiz,
          diagram,
        });
      }

      await ctx.runMutation(internal.courses.updateStatus, { courseId, status: "ready" });
    } catch (err) {
      console.error("adminGenerateCourse failed:", err);
      await ctx.runMutation(internal.courses.updateStatus, { courseId, status: "error" }).catch(() => {});
      throw err;
    }

    return courseId;
  },
});

// ── Mobile/user course generation ─────────────────────────────────────────────

export const generateCourse = action({
  args: {
    courseId: v.id("courses"),
    pdfBase64: v.optional(v.string()),
    imageBase64: v.optional(v.string()),
    pdfStorageId: v.optional(v.id("_storage")),
    transcript: v.optional(v.string()),
    youtubeUrl: v.optional(v.string()),
    courseTopic: v.optional(v.string()),
    lessonCount: v.number(),
    difficulty: v.union(
      v.literal("beginner"),
      v.literal("intermediate"),
      v.literal("advanced"),
    ),
    userPrompt: v.optional(v.string()),
    includeFlashcards: v.optional(v.boolean()),
    includeQuiz: v.optional(v.boolean()),
    includeDiagram: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    { courseId, pdfBase64, imageBase64, pdfStorageId, transcript, youtubeUrl, courseTopic, lessonCount, difficulty, userPrompt, ...flags },
  ) => {
    const includeFlashcards = flags.includeFlashcards !== false;
    const includeQuiz       = flags.includeQuiz !== false;
    const includeDiagram    = flags.includeDiagram === true;

    try {
      console.log("[generateCourse] start", { courseId, hasPdfBase64: !!pdfBase64, hasPdfStorageId: !!pdfStorageId, hasTranscript: !!transcript, hasYoutube: !!youtubeUrl, hasTopic: !!courseTopic });
      const geminiKey = process.env.GEMINI_API_KEY;

      if (!geminiKey)
        throw new Error(
          "No AI API key set. Add GEMINI_API_KEY in Convex env vars.",
        );

      if (!pdfBase64 && !imageBase64 && !pdfStorageId && !transcript && !youtubeUrl && !courseTopic)
        throw new Error("A content source (PDF, image, YouTube, transcript, or topic) must be provided.");

      // Resolve pdfStorageId → pdfBase64 if needed
      if (pdfStorageId && !pdfBase64) {
        const blob = await ctx.storage.get(pdfStorageId);
        if (!blob) throw new Error("Uploaded PDF not found in storage.");
        const arrayBuffer = await blob.arrayBuffer();
        pdfBase64 = Buffer.from(arrayBuffer).toString('base64');
      }

      let raw: string;
      console.log("[generateCourse] calling Gemini...");
      if (transcript) {
        raw = await callGeminiText(transcript, lessonCount, difficulty, geminiKey, userPrompt, includeFlashcards, includeQuiz, includeDiagram);
      } else if (youtubeUrl) {
        raw = await callGeminiVideo(youtubeUrl, lessonCount, difficulty, geminiKey, userPrompt, includeFlashcards, includeQuiz, includeDiagram);
      } else if (imageBase64) {
        raw = await callGeminiImage(imageBase64, lessonCount, difficulty, geminiKey, userPrompt, includeFlashcards, includeQuiz, includeDiagram);
      } else if (pdfBase64) {
        raw = await callGemini(pdfBase64, lessonCount, difficulty, geminiKey, userPrompt, includeFlashcards, includeQuiz, includeDiagram);
      } else {
        // Topic-only: generate from course name with no source document
        raw = await callGeminiExamTopic(courseTopic!, lessonCount, difficulty, geminiKey, userPrompt, includeFlashcards, includeQuiz, includeDiagram);
      }
      console.log("[generateCourse] Gemini returned", raw.length, "chars");

      // Strip markdown fences if present
      raw = raw
        .replace(/^```json\n?/, "")
        .replace(/^```\n?/, "")
        .replace(/```\n?$/, "")
        .trim();

      const courseData = parseOrRepair(raw);

      await ctx.runMutation(internal.courses.patchTitleAndDescription, {
        courseId,
        title: courseData.title ?? "Untitled Course",
        description: courseData.description ?? "",
        totalLessons: courseData.lessons?.length ?? lessonCount,
      });

      // Clear any lessons from a previous attempt before inserting (handles action retries)
      await ctx.runMutation(internal.courses.clearLessons, { courseId });

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

        const diagram =
          lesson.diagram?.root && Array.isArray(lesson.diagram?.branches)
            ? {
                root: String(lesson.diagram.root),
                branches: (lesson.diagram.branches as any[])
                  .filter((b: any) => b?.name && Array.isArray(b.points))
                  .map((b: any) => ({
                    name: String(b.name),
                    points: (b.points as any[]).map(String),
                  })),
              }
            : undefined;

        await ctx.runMutation(internal.courses.insertLesson, {
          courseId,
          lessonNumber: Number(lesson.lessonNumber) || 1,
          title: lesson.title ?? `Lesson ${lesson.lessonNumber}`,
          keyConcept: lesson.keyConcept ?? "",
          content,
          flashcards,
          quiz,
          diagram,
        });
      }

      await ctx.runMutation(internal.courses.updateStatus, {
        courseId,
        status: "ready",
      });
    } catch (err) {
      console.error("generateCourse failed:", err);
      try {
        await ctx.runMutation(internal.courses.updateStatus, { courseId, status: "error" });
        await ctx.runMutation(api.courses.remove, { courseId });
      } catch (cleanupErr) {
        console.error("cleanup failed (course left as error status):", cleanupErr);
      }
      const errMsg = (err as any)?.message ?? "";
      if (errMsg.includes("exceeds the supported page limit") || errMsg.includes("page limit")) {
        throw new Error("PDF_TOO_LONG: Your PDF has too many pages (Gemini supports up to 1000). Try uploading a specific chapter or a shorter section.");
      }
      throw err;
    }
  },
});

// ── On-demand: generate quiz for all lessons of a course ──────────────────────

export const generateQuizForCourse = action({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) throw new Error("No AI API key set.");

    const lessons = await ctx.runQuery(api.courses.getLessons, { courseId });
    if (!lessons?.length) throw new Error("No lessons found.");

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    let totalSaved = 0;

    for (const lesson of lessons as any[]) {
      if ((lesson.quiz ?? []).length > 0) continue;

      const prompt = `Generate exactly 4 multiple-choice quiz questions for this lesson.
Lesson title: ${lesson.title}
Key concept: ${lesson.keyConcept}
Content: ${(lesson.content ?? []).map((s: any) => `${s.heading}: ${s.body}`).join('\n')}

Rules:
- Each question must be a short fact-pattern or scenario based on the lesson content.
- Provide exactly 4 answer options. The correctAnswer must be copied EXACTLY (character-for-character) from one of the options.
- Return ONLY a valid JSON array, no markdown, no explanation.

[{"question":"...","options":["Full answer text A","Full answer text B","Full answer text C","Full answer text D"],"correctAnswer":"Full answer text A"}]`;

      try {
        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 0 },
          } as any,
        });
        const raw = result.response.text().trim();
        const parsed = JSON.parse(raw);
        const quiz = (Array.isArray(parsed) ? parsed : [])
          .filter((q: any) => q?.question && Array.isArray(q.options) && q.options.length === 4 && q.correctAnswer)
          .map((q: any) => ({
            question: String(q.question),
            options: q.options.map(String),
            correctAnswer: String(q.correctAnswer),
          }));

        if (quiz.length > 0) {
          await ctx.runMutation(internal.courses.patchLessonQuiz, { lessonId: lesson._id, quiz });
          totalSaved += quiz.length;
        }
      } catch (e) {
        console.error("Quiz generation failed for lesson", lesson._id, e);
      }
    }

    if (totalSaved === 0) {
      throw new Error("Quiz generation failed — no questions were saved. Please try again.");
    }
  },
});

// ── On-demand: generate mind map diagrams for all lessons of a course ─────────

export const generateDiagramForCourse = action({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) throw new Error("No AI API key set.");

    const lessons = await ctx.runQuery(api.courses.getLessons, { courseId });
    console.log("[diagram] lessons fetched:", lessons?.length ?? 0);
    if (!lessons?.length) throw new Error("No lessons found.");

    const todo = (lessons as any[]).filter((l: any) => !l.diagram);
    console.log("[diagram] lessons needing diagram:", todo.length);

    await Promise.all(
      todo.map(async (lesson: any) => {
        console.log("[diagram] starting lesson:", lesson._id, lesson.title);
        const prompt = `Create a mind map for this lesson.
Lesson title: ${lesson.title}
Key concept: ${lesson.keyConcept}
Content: ${(lesson.content ?? []).map((s: any) => `${s.heading}: ${s.body}`).join('\n')}

Return ONLY a JSON object:
{"root":"central concept (max 6 words)","branches":[{"name":"subtopic","points":["detail 1","detail 2"]}]}
Include 3-5 branches, each with 2-3 points.`;

        try {
          console.log("[diagram] calling Gemini for:", lesson._id);
          const resp = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + geminiKey, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.6, maxOutputTokens: 1024 } }),
          });
          console.log("[diagram] Gemini status:", resp.status, "for:", lesson._id);
          const json = await resp.json();
          console.log("[diagram] Gemini raw response for", lesson._id, ":", JSON.stringify(json).slice(0, 300));
          const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
          const cleaned = raw.replace(/^```json\n?/, "").replace(/^```\n?/, "").replace(/```\n?$/, "").trim();
          console.log("[diagram] cleaned JSON for", lesson._id, ":", cleaned.slice(0, 200));
          const diagram = JSON.parse(cleaned);

          if (diagram?.root && Array.isArray(diagram.branches) && diagram.branches.length > 0) {
            console.log("[diagram] saving diagram for:", lesson._id, "branches:", diagram.branches.length);
            await ctx.runMutation(internal.courses.patchLessonDiagram, { lessonId: lesson._id, diagram });
            console.log("[diagram] saved diagram for:", lesson._id);
          } else {
            console.warn("[diagram] invalid diagram shape for:", lesson._id, diagram);
          }
        } catch (e) {
          console.error("[diagram] FAILED for lesson", lesson._id, e);
        }
      })
    );

    console.log("[diagram] all done for course:", courseId);
  },
});

// ── Feynman: evaluate a user's verbal explanation of a topic ──────────────────

export const evaluateFeynmanExplanation = action({
  args: {
    topicTitle:      v.string(),
    topicSummary:    v.string(),
    userExplanation: v.string(),
    characterAge:    v.number(),
  },
  handler: async (_ctx, { topicTitle, topicSummary, userExplanation, characterAge }) => {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) throw new Error("No Anthropic API key set.");

    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: anthropicKey });

    const system = `You are an expert learning coach evaluating a student's understanding of a topic using the Feynman Technique. The student attempted to explain the topic to someone who is ${characterAge} years old. Your job is to score how well they covered the key concepts and give brief, encouraging feedback.`;

    const userMsg = `TOPIC: ${topicTitle}

KEY CONTENT (ground truth):
${topicSummary}

STUDENT'S EXPLANATION:
${userExplanation}

Evaluate the explanation. Return ONLY valid JSON with no markdown:
{
  "score": <integer 0-100, based on % of key concepts correctly explained>,
  "feedback": "<2-3 sentence encouraging feedback — what they got right, what was missing>",
  "gaps": ["<key concept they missed or got wrong>", ...]
}`;

    const message = await client.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 512,
      system,
      messages: [{ role: "user", content: userMsg }],
    });

    const block = message.content.find((b: any) => b.type === "text");
    const raw = (block as any)?.text?.trim() ?? "{}";
    const cleaned = raw.replace(/^```json\n?/, "").replace(/^```\n?/, "").replace(/```\n?$/, "").trim();
    try {
      const result = JSON.parse(cleaned);
      return {
        score:    Math.max(0, Math.min(100, Number(result.score) || 0)),
        feedback: String(result.feedback ?? "Good effort! Keep practising."),
        gaps:     Array.isArray(result.gaps) ? result.gaps.map(String) : [],
      };
    } catch {
      return { score: 0, feedback: "Could not evaluate your explanation. Please try again.", gaps: [] };
    }
  },
});
