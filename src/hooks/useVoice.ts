// /hooks/useVoice.ts
'use client';
import { useCallback } from 'react';

export function useVoice() {
  const play = useCallback((type: 'processing' | 'done') => {
    const map: Record<string, string> = {
      processing: '/sounds/processing.mp3',
      done: '/sounds/done.mp3',
    };
    const src = map[type];
    if (!src) return;
    const audio = new Audio(src);
    audio.volume = 1.0;
    audio.play().catch(() => {
      console.warn('Cannot autoplay sound; user gesture required');
    });
  }, []);

  return { play };
}