import { NextResponse } from "next/server";
import fs from "node:fs";
import leoProfanity from "leo-profanity";
import wordListPath from "word-list";

export const runtime = "nodejs";

let cachedWords = null;
let cachedDailyWord = null;

import wordsRaw from "./words.txt";

export async function GET() {
  if (!cachedWords) {
    const raw = wordsRaw.split(" ");
    const five = raw.filter((w) => /^[a-zA-Z]{5}$/.test(w));
    leoProfanity.clearList();
    leoProfanity.loadDictionary();
    cachedWords = five
      .map((w) => w.toUpperCase())
      .filter((w) => !leoProfanity.check(w.toLowerCase()));
  }
  if (!cachedDailyWord && cachedWords.length) {
    cachedDailyWord =
      cachedWords[Math.floor(Math.random() * cachedWords.length)];
  }
  return NextResponse.json({ words: cachedWords, dailyWord: cachedDailyWord });
}


