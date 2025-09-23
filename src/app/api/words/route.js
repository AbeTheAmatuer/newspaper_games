import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import leoProfanity from "leo-profanity";
import wordListPath from "word-list";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

let cachedWords = null; // allowed guesses (full dictionary)
let cachedAnswerWords = null; // answer pool (from public/words.txt)
let cachedDailyWord = null;
let cachedRandWord = null;
let mode = "daily";

export async function GET(request) {
  try {
    // Read mode from query string (?mode=daily|random) and reset cachedDailyWord so it can be recalculated below
    try {
      const url = new URL(request.url);
      const q = (url.searchParams.get("mode") || "").toLowerCase();
      if (q === "random") {
        mode = "random";
        cachedDailyWord = null;
      } else {
        mode = "daily";
        cachedDailyWord = null;
      }
    } catch {}
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

    if (!cachedAnswerWords) {
      // Load answer pool from public/words.txt
      const wordsTxtPath = path.join(process.cwd(), "public", "words.txt");
      const ansText = await fs.promises.readFile(wordsTxtPath, "utf8");
      const ansRaw = ansText.split(/\r?\n|\s+/);
      const ansFive = ansRaw.filter((w) => /^[a-zA-Z]{5}$/.test(w));
      cachedAnswerWords = ansFive
        .map((w) => w.toUpperCase())
        .filter((w) => w && !leoProfanity.check(w.toLowerCase()));
      if (cachedAnswerWords.length === 0) {
        throw new Error("No valid 5-letter words in public/words.txt");
      }
    }


    if (!cachedDailyWord) {
      if (mode === "daily") {
        const now = new Date();
      const dayNumber = Math.floor(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) /
          86400000
      );
      const index = dayNumber % cachedAnswerWords.length;
      cachedDailyWord = cachedAnswerWords[index];
      }
      else if (mode === "random") {
        cachedDailyWord = cachedAnswerWords[Math.floor(Math.random() * cachedAnswerWords.length)];
      }
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