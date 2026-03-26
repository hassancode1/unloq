"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { GoogleGenerativeAI } from "@google/generative-ai";

function buildPrompt(lessonCount: number, difficulty: string): string {
  return `You are an expert course designer. Analyse the attached PDF document and generate a ${lessonCount}-lesson ${difficulty} course strictly based on its content.

For each lesson generate:
- 4 flashcards (front = key term or concept, back = clear explanation)
- 4 multiple-choice quiz questions (exactly 4 options, exactly 1 correct answer)

Return ONLY valid JSON with this exact structure — no markdown, no extra text:
{
  "title": "Course title based on the document",
  "description": "2-3 sentence course summary",
  "lessons": [
    {
      "lessonNumber": 1,
      "title": "Lesson title",
      "keyConcept": "One-sentence summary of what this lesson covers",
      "flashcards": [
        { "front": "Term or question", "back": "Explanation or answer" }
      ],
      "quiz": [
        {
          "question": "Question text?",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correctAnswer": "Option A"
        }
      ]
    }
  ]
}`;
}

export const generateCourse = action({
  args: {
    courseId: v.id("courses"),
    pdfBase64: v.string(),
    lessonCount: v.number(),
    difficulty: v.union(
      v.literal("beginner"),
      v.literal("intermediate"),
      v.literal("advanced")
    ),
  },
  handler: async (ctx, { courseId, pdfBase64, lessonCount, difficulty }) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("GEMINI_API_KEY not set in Convex env vars");

      const genAI = new GoogleGenerativeAI(apiKey);
      // gemini-1.5-flash supports inline PDF data and is fast + cheap
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: "application/pdf",
            data: pdfBase64,
          },
        },
        { text: buildPrompt(lessonCount, difficulty) },
      ]);

      let text = result.response.text().trim();

      // Strip markdown code fences if present
      if (text.startsWith("```json")) {
        text = text.replace(/```json\n?/g, "").replace(/```\n?/g, "");
      } else if (text.startsWith("```")) {
        text = text.replace(/```\n?/g, "");
      }

      const courseData = JSON.parse(text);

      // Update course title/description with AI-generated values
      await ctx.runMutation(api.courses.patchTitleAndDescription, {
        courseId,
        title: courseData.title ?? "Untitled Course",
        description: courseData.description ?? "",
        totalLessons: courseData.lessons?.length ?? lessonCount,
      });

      // Insert lessons
      const lessons: any[] = Array.isArray(courseData.lessons) ? courseData.lessons : [];

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
              q.options.includes(q.correctAnswer)
          )
          .map((q: any) => ({
            question: String(q.question),
            options: q.options.map(String),
            correctAnswer: String(q.correctAnswer),
          }));

        await ctx.runMutation(api.courses.insertLesson, {
          courseId,
          lessonNumber: Number(lesson.lessonNumber) || 1,
          title: lesson.title ?? `Lesson ${lesson.lessonNumber}`,
          keyConcept: lesson.keyConcept ?? "",
          flashcards,
          quiz,
        });
      }

      await ctx.runMutation(api.courses.updateStatus, { courseId, status: "ready" });
    } catch (err) {
      console.error("generateCourse failed:", err);
      await ctx.runMutation(api.courses.updateStatus, { courseId, status: "error" });
    }
  },
});
