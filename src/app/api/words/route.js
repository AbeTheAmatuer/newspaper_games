import { NextResponse } from "next/server";
import fs from "node:fs";
import leoProfanity from "leo-profanity";
import wordListPath from "word-list";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

let cachedWords = null;
let cachedDailyWord = null;

export async function GET() {
  try {
    if (!cachedWords) {
      let text = "";
      try {
        // Primary: local dictionary from word-list package
        text = await fs.promises.readFile(wordListPath, "utf8");
      } catch (e) {
        // Fallback: fetch from public dictionary repo (one-time, then memory-cached)
        const remoteUrl = "https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt";
        const resp = await fetch(remoteUrl, { cache: "no-store" });
        if (!resp.ok) {
          throw new Error(`Failed remote dict ${resp.status}`);
        }
        text = await resp.text();
      }
      const raw = text.split(/\r?\n|\s+/);
      const five = raw.filter((w) => /^[a-zA-Z]{5}$/.test(w));
      leoProfanity.clearList();
      leoProfanity.loadDictionary();
      cachedWords = five
        .map((w) => w.toUpperCase())
        .filter((w) => !leoProfanity.check(w.toLowerCase()));
    }

    if (!cachedWords || cachedWords.length === 0) {
      throw new Error("No words loaded from word-list");
    }

    if (!cachedDailyWord) {
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
  } catch (err) {
    return NextResponse.json(
      { error: (err && err.message) || "Unknown error loading dictionary" },
      { status: 500 }
    );
  }
}