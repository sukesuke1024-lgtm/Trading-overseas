"use client";

import { useEffect, useState } from "react";

export default function LikeButton({ slug, initial }: { slug: string; initial: number }) {
  const [likes, setLikes] = useState(initial);
  const [liked, setLiked] = useState(false);
  const key = `liked:${slug}`;

  useEffect(() => {
    try {
      setLiked(localStorage.getItem(key) === "1");
    } catch {}
  }, [key]);

  async function like() {
    if (liked) return;
    setLiked(true);
    setLikes((n) => n + 1);
    try {
      localStorage.setItem(key, "1");
    } catch {}
    const res = await fetch(`/api/components/${slug}/like`, { method: "POST" });
    if (res.ok) setLikes((await res.json()).likes);
  }

  return (
    <button
      type="button"
      onClick={like}
      aria-pressed={liked}
      aria-label={`Like (${likes})`}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-xs transition ${
        liked ? "border-accent/60 text-accent" : "border-line text-fg hover:bg-surface-2"
      }`}
    >
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <path d="M10 17s-6.5-4.1-6.5-8.6A3.4 3.4 0 0 1 10 6.8a3.4 3.4 0 0 1 6.5 1.6C16.5 12.9 10 17 10 17Z" />
      </svg>
      {likes}
    </button>
  );
}
