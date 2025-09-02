"use client";

import { useEffect, useMemo, useState } from "react";

const ROWS = 6;
const COLS = 5;

function evaluateGuess(guess, answer) {
  const result = Array(COLS).fill("absent");
  const counts = {};
  for (let i = 0; i < COLS; i++) counts[answer[i]] = (counts[answer[i]] || 0) + 1;
  for (let i = 0; i < COLS; i++) if (guess[i] === answer[i]) { result[i] = "correct"; counts[guess[i]]--; }
  for (let i = 0; i < COLS; i++) if (result[i] === "absent" && counts[guess[i]] > 0) { result[i] = "present"; counts[guess[i]]--; }
  return result;
}

function classFor(status) {
  if (status === "correct") return "bg-green-600 text-white";
  if (status === "present") return "bg-yellow-500 text-white";
  if (status === "absent") return "bg-gray-500 text-white";
  return "border border-gray-400";
}

export default function Home() {
  const [words, setWords] = useState([]);
  const [answer, setAnswer] = useState("");
  const [guesses, setGuesses] = useState([]); // array of strings
  const [current, setCurrent] = useState("");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [keyStatus, setKeyStatus] = useState({}); // letter -> best status
  const [evaluations, setEvaluations] = useState([]); // array of arrays of statuses revealed sequentially
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/words");
        //const data = await res.json();
        //setWords(data.words || []);
        setAnswer(await res.text().dailyWord);
        console.log("text" + await res.text());
        console.log("status," + res.status);
        setMessage("no err", answer)
      } catch (e) {
        const res = await fetch("/api/words");
        setMessage("Failed to load dictionarry", res);
        console.log(res + "FAILED" + e);
      }
    }
    load();
  }, []);

  function updateKeyStatus(guess, evals) {
    setKeyStatus(prev => {
      const rank = { absent: 0, present: 1, correct: 2 };
      const next = { ...prev };
      for (let i = 0; i < COLS; i++) {
        const letter = guess[i];
        const s = evals[i];
        if (!next[letter] || rank[s] > rank[next[letter]]) next[letter] = s;
      }
      return next;
    });
  }

  function updateKeyStatusIncremental(letter, status) {
    setKeyStatus(prev => {
      const rank = { absent: 0, present: 1, correct: 2 };
      const currentStatus = prev[letter];
      if (!currentStatus || rank[status] > rank[currentStatus]) {
        return { ...prev, [letter]: status };
      }
      return prev;
    });
  }

  function submit() {
    if (!answer) { flash("Loading…"); return; }
    if (done || animating) return;
    if (current.length !== COLS) return flash("Not enough letters");
    if (words.length > 0 && !words.includes(current)) return flash("Not in word list");
    const evalsComplete = evaluateGuess(current, answer);
    const rowIndex = guesses.length;
    setAnimating(true);
    setGuesses(prev => [...prev, current]);
    setEvaluations(prev => [...prev, Array(COLS).fill(undefined)]);
    const guessWord = current;
    setCurrent("");
    for (let i = 0; i < COLS; i++) {
      setTimeout(() => {
        setEvaluations(prev => {
          const next = [...prev];
          const row = [...next[rowIndex]];
          row[i] = evalsComplete[i];
          next[rowIndex] = row;
          return next;
        });
        updateKeyStatusIncremental(guessWord[i], evalsComplete[i]);
        if (i === COLS - 1) {
          // Finalize after last reveal
          const nextGuessesLength = rowIndex + 1;
          if (guessWord === answer) {
            setDone(true);
            flash("You win!");
          } else if (nextGuessesLength === ROWS) {
            setDone(true);
            flash(`Answer: ${answer}`);
          }
          setAnimating(false);
        }
      }, i * 300);
    }
  }

  function flash(text) {
    setMessage(text);
    setTimeout(() => setMessage(""), 1200);
  }

  function onKey(e) {
    const key = e.key.toUpperCase();
    if (animating) return;
    if (key === "ENTER") return submit();
    if (key === "BACKSPACE") return setCurrent(c => c.slice(0, -1));
    if (/^[A-Z]$/.test(key) && current.length < COLS && !done) setCurrent(c => c + key);
  }

  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const rows = Array.from({ length: ROWS }, (_, r) => {
    const guess = guesses[r] || (r === guesses.length ? current : "");
    const isSubmitted = Boolean(guesses[r]);
    const evals = isSubmitted ? (evaluations[r] || []) : [];
    return { guess, evals, isSubmitted };
  });

  const keyRows = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
  function keyColor(letter) { return classFor(keyStatus[letter]); }
/*
  if (!answer) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div>Loading dictionary…</div>
      </div>
    );
  }
*/
  return (
    <div className="min-h-screen flex flex-col items-center gap-6 p-6">
      <h1 className="text-3xl font-bold tracking-wider">Wordle</h1>
      
      <div className="grid gap-2" style={{ gridTemplateRows: `repeat(${ROWS}, 1fr)` }}>
        {rows.map((row, i) => (
          <div key={i} className="flex gap-2 justify-center">
            {Array.from({ length: COLS }).map((_, c) => {
              const ch = row.guess[c] || "";
              const status = row.isSubmitted ? row.evals[c] : undefined;
              return (
                <div key={c} className={`w-14 h-14 flex items-center justify-center uppercase font-bold text-xl ${classFor(status)} rounded`}>{ch}</div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="h-6 text-sm opacity-80">{message}</div>
      <div className="flex flex-col items-center gap-2 select-none">
        {keyRows.map((row, i) => (
          <div key={i} className="flex gap-2">
            {i === 2 && (
              <button onClick={submit} disabled={animating || done || !answer || current.length !== COLS} className={`px-3 py-2 rounded bg-gray-300 text-black font-semibold ${animating || done || !answer || current.length !== COLS ? 'opacity-50 cursor-not-allowed' : ''}`}>Enter</button>
            )}
            {row.split("").map((k) => (
              <button
                key={k}
                onClick={() => onKey({ key: k })}
                className={`w-9 h-12 rounded font-semibold relative ${keyColor(k)}`}
              >
                {k}
                {keyStatus[k] === 'absent' && (
                  <span className="absolute inset-0 flex items-center justify-center text-red-600 font-extrabold text-xl pointer-events-none">X</span>
                )}
              </button>
            ))}
            {i === 2 && (
              <button onClick={() => onKey({ key: "Backspace" })} className="px-3 py-2 rounded bg-gray-300 text-black font-semibold">⌫</button>
            )}
          </div>
        ))}
      </div>
      {done && (
        <button
          onClick={() => { location.reload(); }}
          className="mt-2 px-3 py-2 rounded bg-blue-600 text-white"
        >
          Play again
        </button>
      )}
    </div>
  );
}
