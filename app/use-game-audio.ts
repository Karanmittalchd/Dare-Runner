 'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Cue = 'jump' | 'shoot' | 'hit' | 'hurt' | 'core' | 'win' | 'burn';
const notes: Record<Exclude<Cue, 'burn'>, number[]> = {
  jump: [220, 520], shoot: [720, 120], hit: [160, 55],
  hurt: [180, 90, 45], core: [660, 880, 1320], win: [523, 659, 784, 1047],
};

export function useGameAudio() {
  const audio = useRef<AudioContext | null>(null);
  const master = useRef<GainNode | null>(null);
  const mutedRef = useRef(false);
  const [muted, setMuted] = useState(false);

  const unlockAudio = useCallback(() => {
    try {
      if (!audio.current) {
        audio.current = new AudioContext();
        master.current = audio.current.createGain();
        master.current.gain.value = mutedRef.current ? 0 : 0.12;
        master.current.connect(audio.current.destination);
      }
      if (audio.current.state === 'suspended') void audio.current.resume().catch(() => {});
    } catch { /* Audio is optional; gameplay works when unavailable. */ }
  }, []);

  const sound = useCallback((cue: Cue) => {
    const context = audio.current;
    const output = master.current;
    if (!context || !output || context.state !== 'running' || mutedRef.current) return;
    if (cue === 'burn') {
      // Filtered noise creates a short crackling sizzle instead of a musical hit.
      const duration = 0.65;
      const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const crackle = Math.random() < 0.006 ? 1 : 0.35;
        data[i] = (Math.random() * 2 - 1) * crackle;
      }
      const source = context.createBufferSource();
      source.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(6500, context.currentTime);
      filter.frequency.exponentialRampToValueAtTime(650, context.currentTime + duration);
      const envelope = context.createGain();
      envelope.gain.setValueAtTime(0, context.currentTime);
      envelope.gain.linearRampToValueAtTime(1.4, context.currentTime + 0.02);
      envelope.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
      source.connect(filter); filter.connect(envelope); envelope.connect(output);
      source.onended = () => { source.disconnect(); filter.disconnect(); envelope.disconnect(); };
      source.start(); source.stop(context.currentTime + duration);
      return;
    }
    const sequence = notes[cue];
    const melodic = cue === 'core' || cue === 'win';
    const duration = cue === 'win' ? 0.16 : 0.09;
    sequence.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      const start = context.currentTime + index * duration;
      oscillator.type = melodic ? 'sine' : 'triangle';
      oscillator.frequency.setValueAtTime(frequency, start);
      if (!melodic) oscillator.frequency.exponentialRampToValueAtTime(Math.max(25, frequency * 0.6), start + duration);
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(0.6, start + 0.006);
      envelope.gain.exponentialRampToValueAtTime(0.001, start + duration);
      oscillator.connect(envelope); envelope.connect(output);
      oscillator.start(start); oscillator.stop(start + duration + 0.01);
      oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
    });
  }, []);

  const toggleMuted = useCallback(() => {
    unlockAudio();
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
    if (master.current && audio.current) master.current.gain.setTargetAtTime(mutedRef.current ? 0 : 0.12, audio.current.currentTime, 0.01);
  }, [unlockAudio]);

  useEffect(() => () => {
    if (audio.current) void audio.current.close().catch(() => {});
    audio.current = null; master.current = null;
  }, []);

  return { sound, unlockAudio, muted, toggleMuted };
}
