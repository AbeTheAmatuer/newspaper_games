import { NextResponse } from "next/server";
import fs from "node:fs";
import leoProfanity from "leo-profanity";
import wordListPath from "word-list";

export const runtime = "nodejs";

let cachedWords = null;
let cachedDailyWord = null;

export async function GET() {
  if (!cachedWords) {
    const text = await fs.promises.readFile(wordListPath, "utf8");
    const raw = text.split(/\r?\n/);
    const five = raw.filter((w) => /^[a-zA-Z]{5}$/.test(w));
    leoProfanity.clearList();
    leoProfanity.loadDictionary();
    cachedWords = five
      .map((w) => w.toUpperCase())
      .filter((w) => !leoProfanity.check(w.toLowerCase()));
  }

  if (!cachedDailyWord && cachedWords && cachedWords.length) {
    const now = new Date();
    const dayNumber = Math.floor(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) /
        86400000
    );
    const index = dayNumber % cachedWords.length;
    cachedDailyWord = cachedWords[index];
  }

  return NextResponse.json({
    words: cachedWords,
    dailyWord: cachedDailyWord,
  });
}