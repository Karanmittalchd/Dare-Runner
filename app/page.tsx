'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { Crosshair, Gem, Heart, RotateCcw, Zap } from 'lucide-react';
import { loadSprites, loadAnimationSprites, drawSprite, atmosphere } from './hd-renderer';
import { useGameAudio } from './use-game-audio';
import { playerBounds } from './player-geometry';
import { heroPose, heroMuzzle, heroAnchors, heroUpAnchors, HERO_UP_CELL_SIZE, HERO_CELL_SIZE } from './hero-geometry';
import { Button } from '@/components/ui/button';

const VIEW_WIDTH = 320;
const VIEW_HEIGHT = 192;


type Platform = { x: number; y: number; w: number; h: number };
type Core = { x: number; y: number; taken: boolean };
type Enemy = {
  x: number;
  y: number;
  min: number;
  max: number;
  direction: number;
  alive: boolean;
  flying?: boolean;
  kind?: 'armored' | 'sentry' | 'hunter' | 'dragon' | 'yeti' | 'ice-dragon' | 'frost-king';
  moving?: boolean;
  animation?: number;
  hp?: number;
  cooldown?: number;
};
type DragonFire = { x: number; y: number; vx: number; vy: number; life: number };
type Bullet = { x: number; y: number; direction: number; up?: boolean; flame?: boolean };
type ModelContextDocument = Document & {
  modelContext?: {
    registerTool: (
      tool: {
        name: string;
        title: string;
        description: string;
        inputSchema: object;
        annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
        execute: (input: unknown) => unknown;
      },
      options: { signal: AbortSignal },
    ) => void | Promise<void>;
  };
};

const firstPlatforms: Platform[] = [
  { x: 0, y: 176, w: 298, h: 16 },
  { x: 342, y: 176, w: 150, h: 16 },
  { x: 512, y: 153, w: 118, h: 12 },
  { x: 646, y: 176, w: 176, h: 16 },
  { x: 742, y: 124, w: 110, h: 12 },
  { x: 850, y: 176, w: 150, h: 16 },
  { x: 1014, y: 146, w: 92, h: 12 },
  { x: 1100, y: 176, w: 120, h: 16 },
];

const firstSpikes = [
  { x: 145, y: 169, w: 28 },
  { x: 430, y: 169, w: 28 },
  { x: 690, y: 169, w: 32 },
  { x: 916, y: 169, w: 26 },
  { x: 1136, y: 169, w: 22 },
];

const firstCores: Core[] = [
  { x: 252, y: 148, taken: false },
  { x: 565, y: 125, taken: false },
  { x: 797, y: 96, taken: false },
];

const firstEnemies: Enemy[] = [
  { x: 220, y: 160, min: 196, max: 278, direction: 1, alive: true },
  { x: 522, y: 131, min: 520, max: 613, direction: 1, alive: true },
  { x: 680, y: 148, min: 665, max: 790, direction: -1, alive: true },
  { x: 804, y: 78, min: 765, max: 840, direction: 1, alive: true, flying: true },
  { x: 930, y: 160, min: 870, max: 980, direction: 1, alive: true },
];

type Powerup = { x: number; y: number; kind: 'shield' | 'rapid' | 'life' | 'flame'; taken: boolean };
type Level = { icy?: boolean; icicles?: number[]; barriers?: { x: number; y: number; w: number; h: number; hp: number }[]; powerups?: Powerup[]; name: string; width: number; gateX: number; platforms: Platform[]; spikes: { x: number; y: number; w: number }[]; cores: Core[]; enemies: Enemy[] };
const levels: Level[] = [
  { name: 'Cinder Caverns', width: 1220, gateX: 1165, platforms: firstPlatforms, spikes: firstSpikes, cores: firstCores, enemies: firstEnemies },
  {
    name: 'The Ember Ascent', width: 1580, gateX: 1535,
    platforms: [
      { x: 0, y: 176, w: 220, h: 16 }, { x: 248, y: 153, w: 110, h: 14 },
      { x: 382, y: 127, w: 130, h: 14 }, { x: 540, y: 153, w: 145, h: 14 },
      { x: 710, y: 176, w: 165, h: 16 }, { x: 785, y: 122, w: 80, h: 12 },
      { x: 900, y: 148, w: 135, h: 14 }, { x: 1060, y: 118, w: 115, h: 14 },
      { x: 1195, y: 150, w: 135, h: 14 }, { x: 1355, y: 176, w: 225, h: 16 },
    ],
    spikes: [{ x: 144, y: 169, w: 28 }, { x: 580, y: 146, w: 28 }, { x: 738, y: 169, w: 28 }, { x: 946, y: 141, w: 28 }, { x: 1238, y: 143, w: 28 }, { x: 1420, y: 169, w: 35 }],
    cores: [{ x: 452, y: 99, taken: false }, { x: 820, y: 94, taken: false }, { x: 1115, y: 90, taken: false }],
    enemies: [
      { x: 285, y: 139, min: 265, max: 330, direction: 1, alive: true },
      { x: 465, y: 76, min: 418, max: 497, direction: -1, alive: true, flying: true },
      { x: 644, y: 139, min: 625, max: 667, direction: -1, alive: true },
      { x: 832, y: 71, min: 790, max: 856, direction: 1, alive: true, flying: true },
      { x: 997, y: 134, min: 985, max: 1015, direction: 1, alive: true },
      { x: 1120, y: 67, min: 1070, max: 1160, direction: -1, alive: true, flying: true },
      { x: 1487, y: 162, min: 1470, max: 1510, direction: 1, alive: true },
    ],
  },
  {
    name: 'Obsidian Stronghold', width: 1800, gateX: 1750,
    platforms: [
      { x: 0, y: 176, w: 240, h: 16 }, { x: 265, y: 151, w: 150, h: 14 },
      { x: 440, y: 124, w: 140, h: 14 }, { x: 605, y: 151, w: 160, h: 14 },
      { x: 790, y: 176, w: 170, h: 16 }, { x: 870, y: 124, w: 80, h: 12 },
      { x: 985, y: 148, w: 140, h: 14 }, { x: 1150, y: 119, w: 135, h: 14 },
      { x: 1310, y: 146, w: 160, h: 14 }, { x: 1495, y: 176, w: 305, h: 16 },
    ],
    spikes: [{ x: 166, y: 169, w: 28 }, { x: 652, y: 144, w: 28 }, { x: 814, y: 169, w: 28 }, { x: 1020, y: 141, w: 28 }, { x: 1350, y: 139, w: 28 }, { x: 1560, y: 169, w: 35 }],
    cores: [{ x: 495, y: 96, taken: false }, { x: 909, y: 96, taken: false }, { x: 1200, y: 91, taken: false }],
    enemies: [
      { x: 333, y: 137, min: 310, max: 386, direction: -1, alive: true, kind: 'armored', hp: 3 },
      { x: 539, y: 110, min: 539, max: 539, direction: -1, alive: true, kind: 'sentry', hp: 4, cooldown: 110 },
      { x: 709, y: 137, min: 700, max: 743, direction: -1, alive: true, kind: 'armored', hp: 3 },
      { x: 924, y: 74, min: 880, max: 940, direction: -1, alive: true, flying: true, kind: 'hunter', hp: 2 },
      { x: 1092, y: 134, min: 1092, max: 1092, direction: -1, alive: true, kind: 'sentry', hp: 4, cooldown: 110 },
      { x: 1240, y: 69, min: 1170, max: 1260, direction: 1, alive: true, flying: true, kind: 'hunter', hp: 2 },
      { x: 1420, y: 132, min: 1400, max: 1445, direction: -1, alive: true, kind: 'armored', hp: 3 },
      { x: 1688, y: 162, min: 1688, max: 1688, direction: -1, alive: true, kind: 'sentry', hp: 4, cooldown: 110 },
    ],
    powerups: [{ x: 82, y: 161, kind: 'shield', taken: false }, { x: 282, y: 137, kind: 'rapid', taken: false }, { x: 795, y: 161, kind: 'life', taken: false }, { x: 1164, y: 105, kind: 'rapid', taken: false }, { x: 1505, y: 161, kind: 'shield', taken: false }],
  },
  {
    name: 'Frostbite Pass', icy: true, width: 1430, gateX: 1375,
    platforms: [
      { x: 0, y: 176, w: 270, h: 16 }, { x: 300, y: 159, w: 150, h: 16 },
      { x: 476, y: 137, w: 155, h: 16 }, { x: 655, y: 164, w: 155, h: 16 },
      { x: 832, y: 176, w: 155, h: 16 }, { x: 1010, y: 148, w: 170, h: 16 },
      { x: 1205, y: 176, w: 225, h: 16 },
    ],
    spikes: [{ x: 185, y: 169, w: 24 }, { x: 714, y: 157, w: 24 }, { x: 1270, y: 169, w: 28 }],
    cores: [{ x: 365, y: 131, taken: false }, { x: 558, y: 109, taken: false }, { x: 1100, y: 120, taken: false }],
    enemies: [
      { x: 345, y: 146, min: 318, max: 418, direction: -1, alive: true, kind: 'yeti', hp: 3 },
      { x: 605, y:  70, min: 525, max: 615, direction: -1, alive: true, flying: true, kind: 'ice-dragon', hp: 4, cooldown: 140 },
      { x: 917, y: 163, min: 857, max: 956, direction: -1, alive: true, kind: 'yeti', hp: 3 },
      { x: 1314, y: 90, min: 1250, max: 1350, direction: -1, alive: true, flying: true, kind: 'ice-dragon', hp: 4, cooldown: 140 },
    ],
    powerups: [{ x: 80, y: 161, kind: 'flame', taken: false }, { x: 669, y: 149, kind: 'shield', taken: false }, { x: 1030, y: 133, kind: 'flame', taken: false }],
    icicles: [390, 765, 1150], barriers: [{ x: 228, y: 142, w: 14, h: 34, hp: 6 }],
  },
  {
    name: 'Crystal Caverns', icy: true, width: 1650, gateX: 1595,
    platforms: [
      { x: 0, y: 176, w: 245, h: 16 }, { x: 272, y: 150, w: 135, h: 16 },
      { x: 430, y: 122, w: 150, h: 16 }, { x: 605, y: 153, w: 145, h: 16 },
      { x: 777, y: 176, w: 170, h: 16 }, { x: 970, y: 149, w: 145, h: 16 },
      { x: 1140, y: 121, w: 150, h: 16 }, { x: 1313, y: 149, w: 125, h: 16 },
      { x: 1460, y: 176, w: 190, h: 16 },
    ],
    spikes: [{ x: 174, y: 169, w: 24 }, { x: 660, y: 146, w: 26 }, { x: 827, y: 169, w: 26 }, { x: 1510, y: 169, w: 24 }],
    cores: [{ x: 506, y: 94, taken: false }, { x: 1050, y: 121, taken: false }, { x: 1208, y: 93, taken: false }],
    enemies: [
      { x: 343, y: 137, min: 290, max: 375, direction: -1, alive: true, kind: 'yeti', hp: 4 },
      { x: 546, y: 64, min: 460, max: 560, direction: -1, alive: true, flying: true, kind: 'ice-dragon', hp: 5, cooldown: 140 },
      { x: 913, y: 163, min: 868, max: 923, direction: -1, alive: true, kind: 'yeti', hp: 4 },
      { x: 1220, y: 60, min: 1165, max: 1270, direction: -1, alive: true, flying: true, kind: 'ice-dragon', hp: 5, cooldown: 140 },
      { x: 1402, y: 136, min: 1345, max: 1410, direction: -1, alive: true, kind: 'yeti', hp: 4 },
    ],
    powerups: [{ x: 75, y: 161, kind: 'flame', taken: false }, { x: 610, y: 138, kind: 'life', taken: false }, { x: 983, y: 134, kind: 'flame', taken: false }, { x: 1468, y: 161, kind: 'shield', taken: false }],
    icicles: [354, 704, 1070, 1370], barriers: [{ x: 383, y: 116, w: 14, h: 34, hp: 6 }, { x: 1082, y: 115, w: 14, h: 34, hp: 6 }],
  },
  {
    name: 'Ice King’s Keep', icy: true, width: 1800, gateX: 1750,
    platforms: [
      { x: 0, y: 176, w: 255, h: 16 }, { x: 280, y: 151, w: 150, h: 16 },
      { x: 454, y: 126, w: 150, h: 16 }, { x: 630, y: 153, w: 160, h: 16 },
      { x: 815, y: 176, w: 160, h: 16 }, { x: 1000, y: 146, w: 155, h: 16 },
      { x: 1178, y: 122, w: 145, h: 16 }, { x: 1345, y: 176, w: 455, h: 16 },
    ],
    spikes: [{ x: 183, y: 169, w: 26 }, { x: 689, y: 146, w: 26 }, { x: 860, y: 169, w: 25 }],
    cores: [{ x: 524, y: 98, taken: false }, { x: 1080, y: 118, taken: false }, { x: 1250, y: 94, taken: false }],
    enemies: [
      { x: 362, y: 138, min: 310, max: 402, direction: -1, alive: true, kind: 'yeti', hp: 4 },
      { x: 568, y: 64, min: 485, max: 583, direction: -1, alive: true, flying: true, kind: 'ice-dragon', hp: 5, cooldown: 140 },
      { x: 925, y: 163, min: 899, max: 948, direction: -1, alive: true, kind: 'yeti', hp: 4 },
      { x: 1248, y: 70, min: 1200, max: 1300, direction: -1, alive: true, flying: true, kind: 'ice-dragon', hp: 5, cooldown: 140 },
      { x: 1580, y: 82, min: 1440, max: 1690, direction: -1, alive: true, flying: true, kind: 'frost-king', hp: 18, cooldown: 150 },
    ],
    powerups: [{ x: 75, y: 161, kind: 'flame', taken: false }, { x: 639, y: 138, kind: 'shield', taken: false }, { x: 1008, y: 131, kind: 'flame', taken: false }, { x: 1370, y: 161, kind: 'life', taken: false }, { x: 1410, y: 161, kind: 'flame', taken: false }, { x: 1700, y: 161, kind: 'shield', taken: false }],
    icicles: [389, 745, 1110, 1520, 1650], barriers: [{ x: 1130, y: 112, w: 14, h: 34, hp: 6 }],
  },
];
const initialCores = (level = 0): Core[] => levels[level].cores.map(core => ({ ...core }));
const initialEnemies = (level = 0): Enemy[] => levels[level].icy ? levels[level].enemies.map(enemy => ({ ...enemy })) : [
  ...levels[level].enemies.map(enemy => ({ ...enemy, ...(enemy.flying ? { kind: 'dragon' as const, hp: level + 3, cooldown: 135 } : {}) })),
  { x: 385, y: 98, min: 345, max: 465, direction: -1, flying: true, kind: 'dragon', hp: level + 3, cooldown: 150, alive: true },
];
function enemyBounds(enemy: Enemy, frame: number) {
  const y = enemy.y + (enemy.flying ? Math.sin(frame / 12) * 3 : 0);
  const w = enemy.kind === 'frost-king' ? 44 : enemy.flying ? 28 : enemy.kind === 'sentry' ? 12 : enemy.flying ? 16 : 20;
  const h = enemy.kind === 'frost-king' ? 34 : enemy.kind === 'sentry' ? 12 : 22;
  return { x: enemy.x + 6 - w / 2, y: y + 13 - h, w, h };
}
const locations = [{ name: 'Volcano', description: 'Fire caverns, lava climbs and the Obsidian Stronghold.', levels: [0, 1, 2] }, { name: 'Frozen Citadel', description: 'Glacial passes, crystal caves, and the Ice King’s domain.', levels: [3, 4, 5] }];

const overlap = (
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

const assertNoInput = (input: unknown) => {
  if (
    input === null ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).length !== 0
  ) {
    throw new Error('This action does not accept input.');
  }
};

function pixelText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  align: CanvasTextAlign = 'left',
) {
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = align;
  ctx.fillStyle = '#07121e';
  ctx.fillText(text, x + 1, y + 1);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

export default function Home() {
  const { sound, unlockAudio, muted, toggleMuted } = useGameAudio();
  const dragonFireRef = useRef<DragonFire[]>([]);
  const powerupsRef = useRef<Powerup[]>([]);
  const enemyShotsRef = useRef<Bullet[]>([]);
  const barriersRef = useRef<{ x: number; y: number; w: number; h: number; hp: number }[]>([]);
  const iciclesRef = useRef<{ x: number; y: number; timer: number; falling: boolean; warning: boolean }[]>([]);
  const powersRef = useRef({ shield: false, rapid: 0, flame: 0, grace: 0 });
  const [powerHud, setPowerHud] = useState({ shield: false, rapid: 0, flame: 0 });
  const levelRef = useRef(0);
  const [levelIndex, setLevelIndex] = useState(0);
  const respawnFramesRef = useRef(0);
  const [notice, setNotice] = useState('Jump over fire and lava. Collect three cores to open the exit.');
  const jumpHeldRef = useRef(false);
  const inputSourcesRef = useRef(new Map<string, string>());
  const duckRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pressedRef = useRef(new Set<string>());
  const playerRef = useRef({ x: 24, y: 158, vx: 0, vy: 0, facing: 1 });
  const coresRef = useRef(initialCores());
  const enemiesRef = useRef(initialEnemies());
  const bulletsRef = useRef<Bullet[]>([]);
  const cameraRef = useRef(0);
  const livesRef = useRef(3);
  const scoreRef = useRef(0);
  const gameWonRef = useRef(false);
  const timeRef = useRef(0);
  const shotCooldownRef = useRef(0);
  const [hud, setHud] = useState({ lives: 3, cores: 0, score: 0, won: false });

  const loadLevel = useCallback((index: number, carryScore = false) => {
    powerupsRef.current = (levels[index].powerups ?? []).map(item => ({ ...item }));
    enemyShotsRef.current = [];
    dragonFireRef.current = [];
    powersRef.current = { shield: false, rapid: 0, flame: 0, grace: 0 };
    setPowerHud({ shield: false, rapid: 0, flame: 0 });
    barriersRef.current = (levels[index].barriers ?? []).map(b => ({ ...b }));
    iciclesRef.current = (levels[index].icicles ?? []).map(x => ({ x, y: 24, timer: 0, falling: false, warning: false }));
    levelRef.current = index;
    setLevelIndex(index);
    respawnFramesRef.current = 0;
    setNotice(levels[index].icy ? 'Ice is slippery: hold Down/S to brake. Shoot ice barriers; flame shots melt them faster. Watch for falling icicles.' : index === 0 ? 'Jump over fire and lava. Collect three cores to open the exit.' : index === 1 ? 'Climb the upper ledges for three cores. Watch for flying creatures.' : 'Armored guards take 3 hits. Duck sentry bolts. Collect shield and rapid-fire power-ups.');
    jumpHeldRef.current = false;
    inputSourcesRef.current.clear();
    pressedRef.current.clear();
    duckRef.current = false;
    playerRef.current = { x: 24, y: 158, vx: 0, vy: 0, facing: 1 };
    coresRef.current = initialCores(levelRef.current);
    enemiesRef.current = initialEnemies(levelRef.current);
    bulletsRef.current = [];
    pressedRef.current.clear();
    cameraRef.current = 0;
    livesRef.current = 3;
    if (!carryScore) scoreRef.current = 0;
    shotCooldownRef.current = 0;
    gameWonRef.current = false;
    setHud({ lives: 3, cores: 0, score: scoreRef.current, won: false });
  }, []);

  const resetLevel = useCallback(() => loadLevel(levelRef.current), [loadLevel]);
  const nextLevel = useCallback(() => {
    if (gameWonRef.current && levelRef.current < levels.length - 1) loadLevel(levelRef.current + 1, true);
  }, [loadLevel]);

  const loseLife = useCallback((cause: string, burn = false) => {
    if (!burn && powersRef.current.grace > 0) return;
    if (!burn && powersRef.current.shield) {
      powersRef.current.shield = false; powersRef.current.grace = 60;
      setPowerHud(current => ({ ...current, shield: false }));
      sound('hit'); setNotice('Shield absorbed the hit. Keep moving!'); return;
    }
    powersRef.current = { shield: false, rapid: 0, flame: 0, grace: 0 };
    setPowerHud({ shield: false, rapid: 0, flame: 0 });
    enemyShotsRef.current = [];
    dragonFireRef.current = [];
    powerupsRef.current = (levels[levelRef.current].powerups ?? []).map(item => ({ ...item }));
    iciclesRef.current = (levels[levelRef.current].icicles ?? []).map(x => ({ x, y: 24, timer: 0, falling: false, warning: false }));
    respawnFramesRef.current = 45;
    cameraRef.current = 0;
    shotCooldownRef.current = 0;
    sound(burn && !levels[levelRef.current].icy ? 'burn' : 'hurt');
    const nextLives = livesRef.current - 1;
    livesRef.current = nextLives;
    setNotice(nextLives > 0 ? `${cause} — ${nextLives} ${nextLives === 1 ? 'life' : 'lives'} left. Back at the entrance.` : `${cause} — no lives left. New run started.`);
    jumpHeldRef.current = false;
    inputSourcesRef.current.clear();
    pressedRef.current.clear();
    duckRef.current = false;
    playerRef.current = { x: 24, y: 158, vx: 0, vy: 0, facing: 1 };
    bulletsRef.current = [];
    if (nextLives <= 0) {
      barriersRef.current = (levels[levelRef.current].barriers ?? []).map(b => ({ ...b }));
      livesRef.current = 3;
      scoreRef.current = Math.max(0, scoreRef.current - 250);
      coresRef.current = initialCores(levelRef.current);
      enemiesRef.current = initialEnemies(levelRef.current);
    }
    setHud({
      lives: livesRef.current,
      cores: coresRef.current.filter((core) => core.taken).length,
      score: scoreRef.current,
      won: false,
    });
  }, [sound]);

  const setPressed = useCallback((key: string, down: boolean, source = key) => {
    if (down) { unlockAudio(); inputSourcesRef.current.set(source, key); }
    else inputSourcesRef.current.delete(source);
    pressedRef.current = new Set(inputSourcesRef.current.values());
  }, [unlockAudio]);

  useEffect(() => {
    const bindings: Record<string, string> = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', arrowup: 'jump', w: 'jump', arrowdown: 'duck', s: 'duck', ' ': 'shoot', x: 'shoot', e: 'aimUp' };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && (event.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName))) return;
      const key = event.key.toLowerCase();
      if (bindings[key]) {
        if (key === ' ' && event.target instanceof HTMLElement && event.target.closest('button')) return;
        event.preventDefault();
        if (!event.repeat) setPressed(bindings[key], true, `keyboard:${key}`);
      }
      if (key === 'enter' && gameWonRef.current && levelRef.current < levels.length - 1) { event.preventDefault(); nextLevel(); }
      if (key === 'r' && !event.repeat) { unlockAudio(); resetLevel(); }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (bindings[key]) setPressed(bindings[key], false, `keyboard:${key}`);
    };
    const clearKeys = () => { inputSourcesRef.current.clear(); pressedRef.current.clear(); jumpHeldRef.current = false; };
    const onVisibility = () => { if (document.hidden) clearKeys(); };
    window.addEventListener('blur', clearKeys);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('blur', clearKeys);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [resetLevel, setPressed, unlockAudio, nextLevel]);

  useEffect(() => {
    const context = (document as ModelContextDocument).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const status = () => ({
      lives: livesRef.current,
      coresCollected: coresRef.current.filter((core) => core.taken).length,
      score: scoreRef.current,
      levelComplete: gameWonRef.current,
      level: levelRef.current + 1,
      levelName: levels[levelRef.current].name,
    });

    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: 'get_dare_runner_status',
            title: 'Get game status',
            description: 'Read the current Dare Runner lives, collected cores, score, and completion state.',
            inputSchema: { type: 'object', properties: {}, additionalProperties: false },
            annotations: { readOnlyHint: true, untrustedContentHint: false },
            execute: (input) => {
              assertNoInput(input);
              return status();
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => undefined);
      void Promise.resolve(
        context.registerTool(
          {
            name: 'restart_dare_runner_level',
            title: 'Restart game level',
            description: 'Restart the Cinder Caverns level, restoring lives, cores, enemies, and score.',
            inputSchema: { type: 'object', properties: {}, additionalProperties: false },
            annotations: { readOnlyHint: false, untrustedContentHint: false },
            execute: (input) => {
              assertNoInput(input);
              resetLevel();
              return status();
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => undefined);
    } catch {
      // The game remains fully playable in browsers without WebMCP support.
    }
    return () => lifecycle.abort();
  }, [resetLevel]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.setTransform(4, 0, 0, 4, 0, 0);
    const cavern = new Image();
    cavern.src = '/volcano-arena.png';
    const basalt = new Image(); basalt.src = '/volcano-basalt.png';
    const frozen = new Image(); frozen.src = '/frozen-citadel.png';
    const ice = new Image(); ice.src = '/icy-platform.png';
    const frozenSprites = loadAnimationSprites('/frozen-enemies.png');
    const pickupSprites = loadAnimationSprites('/powerup-atlas.png', { rows: 1, individual: true, columnBreaks: [0, 0.25, 0.5, 1460 / 1983, 1] });
    const sprites = loadSprites('/runner-atlas.png');
    const volcanoSprites = loadAnimationSprites('/volcano-enemies.png');
    const heroUpSprites = loadAnimationSprites('/hero-up.png', { trim: false, rowSplit: 410 / 887, chromaKey: false, lightBackdrop: true });
    const heroSprites = loadAnimationSprites('/hero-hd.png', { trim: false, rowSplit: 425 / 887, chromaKey: false });
    const particles: { x: number; y: number; vx: number; vy: number; life: number; color: string }[] = [];
    const burst = (x: number, y: number, color: string) => {
      for (let i = 0; i < 18; i++) particles.push({ x, y, vx: Math.cos(i * 2.4) * (0.3 + i % 4 * 0.3), vy: Math.sin(i * 2.4) * 1.4, life: 30, color });
    };
    const glow = (x: number, y: number, radius: number, color: string) => {
      const light = ctx.createRadialGradient(x, y, 0, x, y, radius);
      light.addColorStop(0, color); light.addColorStop(1, 'transparent');
      ctx.fillStyle = light; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    };
    let animationFrame = 0;

    const drawBackground = (camera: number) => {
      if (levels[levelRef.current].icy) {
        ctx.fillStyle = '#07152a'; ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
        if (frozen.complete && frozen.naturalWidth) {
          ctx.save();
          if (levelRef.current === 4) ctx.filter = 'hue-rotate(15deg) brightness(0.8)';
          if (levelRef.current === 5) ctx.filter = 'saturate(1.25) brightness(0.85)';
          ctx.drawImage(frozen, -camera * 0.025, -5, VIEW_WIDTH + 46, VIEW_HEIGHT + 12); ctx.restore();
        }
        const fog = ctx.createLinearGradient(0, 130, 0, 192); fog.addColorStop(0, '#8dcaff00'); fog.addColorStop(1, '#abcfff42');
        ctx.fillStyle = fog; ctx.fillRect(0, 130, 320, 62);
        for (let i = 0; i < 55; i++) {
          const x = ((i * 47 - camera * 0.2 - timeRef.current * 0.18) % 340 + 340) % 340;
          const y = (i * 29 + timeRef.current * (0.2 + i % 3 * 0.08)) % 192;
          ctx.fillStyle = i % 3 ? '#d2ebff99' : '#ffffffcc'; ctx.fillRect(x, y, i % 3 ? 0.6 : 1, 0.8);
        }
        return;
      }
      ctx.fillStyle = '#1b0c09';
      ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
      if (cavern.complete && cavern.naturalWidth) {
        ctx.save();
        if (levelRef.current === 1) ctx.filter = 'saturate(0.85) brightness(0.85)';
        if (levelRef.current === 2) ctx.filter = 'saturate(1.2) brightness(0.8)';
        ctx.drawImage(cavern, 0, 0, cavern.naturalWidth, cavern.naturalHeight * 0.76, -camera * 0.025, -12, VIEW_WIDTH + 44, VIEW_HEIGHT + 24);
        ctx.restore();
      }
      const haze = ctx.createLinearGradient(0, 0, 0, VIEW_HEIGHT);
      haze.addColorStop(0, '#16050230'); haze.addColorStop(0.72, '#22090020'); haze.addColorStop(1, '#ff501b40');
      ctx.fillStyle = haze; ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
      atmosphere(ctx, timeRef.current, levelRef.current);
      glow(160, 190, 130, '#f55e2038');
      for (let i = 0; i < 35; i++) {
        const x = ((i * 53.7 - camera * 0.3 + Math.sin(timeRef.current / 90 + i) * 6) % 340 + 340) % 340;
        const y = 192 - ((i * 19 + timeRef.current * (0.08 + i % 3 * 0.03)) % 192);
        ctx.fillStyle = i % 4 ? '#ffb16390' : '#d6532780';
        ctx.beginPath(); ctx.arc(x, y, i % 3 ? 0.28 : 0.6, 0, Math.PI * 2); ctx.fill();
      }
      const lava = ctx.createLinearGradient(0, 183, 0, 192);
      lava.addColorStop(0, '#ffcf62'); lava.addColorStop(0.25, '#fa702c'); lava.addColorStop(1, '#9b201e');
      ctx.fillStyle = lava;
      ctx.beginPath(); ctx.moveTo(0, 192);
      for (let x = 0; x <= 320; x += 2) ctx.lineTo(x, 185 + Math.sin(x / 12 + timeRef.current / 30) * 1.2);
      ctx.lineTo(320, 192); ctx.fill();
      ctx.save(); ctx.strokeStyle = '#ffeb9b'; ctx.lineWidth = 0.35;
      for (let i = 0; i < 23; i++) {
        const x = (i * 19 + timeRef.current * 0.12) % 330;
        const y = 187 + Math.sin(i * 2.8 + timeRef.current / 60) * 2;
        ctx.globalAlpha = 0.25 + Math.sin(i + timeRef.current / 45) * 0.2;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 3, y - 0.6, x + 7, y); ctx.stroke();
      } ctx.restore();
    };

    const drawPlatform = (platform: Platform, camera: number) => {
      const x = platform.x - camera;
      if (x > VIEW_WIDTH || x + platform.w < 0) return;
      ctx.save();
      // The level's collision surface stays flat; the rock face breaks into jagged edges below it.
      ctx.beginPath(); ctx.moveTo(x, platform.y); ctx.lineTo(x + platform.w, platform.y);
      ctx.lineTo(x + platform.w, platform.y + platform.h - 1);
      for (let j = platform.w; j >= 0; j -= 4) {
        const chip = Math.sin((platform.x + j) * 2.7) * 1.1;
        ctx.lineTo(x + j, platform.y + platform.h + chip);
      }
      ctx.lineTo(x, platform.y); ctx.closePath(); ctx.clip();
      const icy = levels[levelRef.current].icy;
      const texture = icy ? ice : basalt;
      ctx.fillStyle = icy ? '#254a70' : '#35251f'; ctx.fillRect(x, platform.y, platform.w, platform.h + 2);
      if (texture.complete && texture.naturalWidth) {
        const tileWidth = 72;
        for (let j = 0; j < platform.w; j += tileWidth) {
          const height = Math.max(14, platform.h + 2);
          ctx.drawImage(texture, 0, 0, texture.naturalWidth, Math.min(texture.naturalHeight, texture.naturalWidth * height / tileWidth), x + j, platform.y, tileWidth, height);
        }
      }
      // Lava lights the undersides, leaving the cool walkable edge clearly readable.
      const reflected = ctx.createLinearGradient(0, platform.y, 0, platform.y + platform.h);
      reflected.addColorStop(0, '#130c0910'); reflected.addColorStop(0.65, '#16070210'); reflected.addColorStop(1, icy ? '#60bbff30' : '#ff481b55');
      ctx.fillStyle = reflected; ctx.fillRect(x, platform.y, platform.w, platform.h + 2);
      ctx.restore();

    };

    const drawLegacyHero = (x: number, y: number, facing: number, frame: number) => {
      const moving = Math.abs(playerRef.current.vx) > 0.2;
      const airborne = Math.abs(playerRef.current.vy) > 0.1;
      const pose = airborne ? 2 : moving && Math.floor(frame / 7) % 2 ? 1 : 0;
      if (drawSprite(ctx, sprites, pose, x + 6, y + 14, 17.5, facing)) {
        glow(x + (facing > 0 ? 8 : 4), y + 2, 6, '#77ffe32a');
        return;
      }
      const bob = Math.abs(playerRef.current.vx) > 0.2 ? Math.sin(frame * 0.55) * 0.4 : Math.sin(frame / 20) * 0.15;
      glow(x + 7, y + 4, 11, '#46ffe21b');
      ctx.save(); ctx.shadowColor = '#000b'; ctx.shadowBlur = 4;
      ctx.fillStyle = '#10152f';
      ctx.fillRect(x + 2, y + 13, 9, 2);
      const helmet = ctx.createLinearGradient(x, y, x + 10, y + 6);
      helmet.addColorStop(0, '#fff1b0'); helmet.addColorStop(0.45, '#e8ae4c'); helmet.addColorStop(1, '#96602d');
      ctx.fillStyle = helmet;
      ctx.fillRect(x + 3, y + 1 + bob, 7, 5);
      ctx.fillStyle = '#183053';
      ctx.fillRect(x + 2, y + 2 + bob, 9, 3);
      ctx.fillStyle = '#45e4d4';
      ctx.fillRect(x + 3, y + 2 + bob, 3, 2);
      ctx.fillRect(x + 7, y + 2 + bob, 3, 2);
      ctx.fillStyle = '#d4fff4';
      ctx.fillRect(x + (facing === 1 ? 8 : 4), y + 2 + bob, 1, 1);
      const suit = ctx.createLinearGradient(x + 2, y, x + 11, y + 14);
      suit.addColorStop(0, '#bc92e3'); suit.addColorStop(0.4, '#7648a8'); suit.addColorStop(1, '#302443');
      ctx.fillStyle = suit;
      ctx.fillRect(x + 2, y + 6 + bob, 9, 7);
      ctx.fillStyle = '#a47acb'; ctx.fillRect(x + 3, y + 7 + bob, 2, 2);
      ctx.fillStyle = '#263440'; ctx.fillRect(x + 6, y + 6 + bob, 1, 6);
      ctx.fillStyle = '#d9ba73'; ctx.fillRect(x + 7.5, y + 7 + bob, 1.3, 1);
      ctx.fillStyle = '#1d2c3c'; ctx.fillRect(x + (facing > 0 ? 0.5 : 10), y + 6 + bob, 2, 5);
      ctx.fillStyle = '#7eb9c1'; ctx.fillRect(x + (facing > 0 ? 0.8 : 10.3), y + 6.5 + bob, 0.6, 3);
      ctx.fillStyle = '#ee6d52';
      ctx.fillRect(x + (facing === 1 ? 10 : 0), y + 7 + bob, 3, 2);
      ctx.fillStyle = '#3ac1bd';
      ctx.fillRect(x + 3, y + 10 + bob, 7, 2);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#d5b8fb'; ctx.fillRect(x + 3, y + 6 + bob, 1, 4);
      ctx.fillStyle = '#21303c';
      const stride = Math.abs(playerRef.current.vx) > 0.2 ? Math.sin(frame * 0.55) * 1.1 : 0;
      ctx.fillRect(x + 3 + stride, y + 12, 2.5, 2); ctx.fillRect(x + 7 - stride, y + 12, 2.5, 2);
      ctx.fillStyle = '#7e929e'; ctx.fillRect(x + (facing > 0 ? 10 : -2), y + 7 + bob, 5, 1.5);
      ctx.shadowColor = '#64fff0'; ctx.shadowBlur = 5;
      ctx.fillStyle = '#9afff2'; ctx.fillRect(x + 4, y + 2.3 + bob, 2, 0.6); ctx.fillRect(x + 8, y + 2.3 + bob, 2, 0.6);
      ctx.restore();
    };

    const drawHero = (x: number, y: number, facing: number, frame: number) => {
      const player = playerRef.current;
      const pose = heroPose(player.vx, player.vy, duckRef.current, frame);
      const aimUp = pressedRef.current.has('aimUp');
      const sprite = (aimUp ? heroUpSprites : heroSprites).frames[pose];
      if (sprite) {
        const anchor = (aimUp ? heroUpAnchors : heroAnchors)[pose];
        const size = aimUp ? HERO_UP_CELL_SIZE : HERO_CELL_SIZE;
        ctx.save(); ctx.translate(x + 6, y + 14); ctx.scale(facing, 1);
        ctx.drawImage(sprite, -anchor.bodyX * size, -anchor.feetY * size, size, size * sprite.height / sprite.width);
        ctx.restore();
      } else {
        ctx.save();
        if (duckRef.current) { ctx.translate(0, (y + 14) * (1 - 8 / 14)); ctx.scale(1, 8 / 14); }
        drawLegacyHero(x, y, facing, frame); ctx.restore();
      }
      if (shotCooldownRef.current > (powersRef.current.rapid > 0 ? 3 : 11)) {
        const muzzle = heroMuzzle(x, y, facing, pose, aimUp);
        glow(muzzle.x, muzzle.y, 5, '#ffdd7788');
        ctx.fillStyle = '#fff3b0'; ctx.beginPath();
        if (aimUp) {
          ctx.moveTo(muzzle.x - 1.3, muzzle.y); ctx.lineTo(muzzle.x, muzzle.y - 4); ctx.lineTo(muzzle.x + 1.3, muzzle.y);
        } else {
          ctx.moveTo(muzzle.x, muzzle.y - 1.3); ctx.lineTo(muzzle.x + facing * 4, muzzle.y); ctx.lineTo(muzzle.x, muzzle.y + 1.3);
        }
        ctx.closePath(); ctx.fill();
      }
    };

    const drawEnemy = (enemy: Enemy, camera: number, frame: number) => {
      const x = Math.floor(enemy.x - camera);
      const y = Math.floor(enemy.y + (enemy.flying ? Math.sin(frame / 12) * 3 : 0));
      if (x < -40 || x > VIEW_WIDTH + 40) return;
      const bounds = enemyBounds(enemy, frame);
      const dragon = !!enemy.flying;
      const frozenEnemy = enemy.kind === 'yeti' || enemy.kind === 'ice-dragon' || enemy.kind === 'frost-king';
      if (dragon || (!enemy.flying && enemy.kind !== 'sentry')) {
        const pose = dragon ? Math.floor(frame / 9) % 4 : enemy.moving ? Math.floor((enemy.animation ?? 0) / 6) % 4 : 0;
        if (drawSprite(ctx, frozenEnemy ? frozenSprites : volcanoSprites, (dragon ? 4 : 0) + pose, x + 6, y + 13, enemy.kind === 'frost-king' ? 48 : dragon ? 30 : frozenEnemy ? 27 : 24, enemy.direction, -1)) {
          for (let i = 0; i < (enemy.hp ?? 1); i++) { ctx.fillStyle = dragon ? '#ffb15c' : '#ff8773'; ctx.fillRect(x - 3 + i * 3, bounds.y - 4, 2, 1); }
          if (dragon && (enemy.cooldown ?? 135) < 30) { glow(x + 6 + enemy.direction * 12, y + 3, 14, '#ff641999'); pixelText(ctx, '!', x + 6, bounds.y - 6, '#ffdf83', 'center'); }
          return;
        }
      }
      const spriteIndex = enemy.flying ? 4 : enemy.kind === 'sentry' ? 5 : 3;
      const spriteHeight = enemy.kind === 'dragon' ? 30 : enemy.flying ? 20 : enemy.kind === 'sentry' ? 15 : 24;
      if (drawSprite(ctx, sprites, spriteIndex, x + 6, y + 13, spriteHeight, enemy.direction, -1)) {
        if (enemy.kind) for (let i = 0; i < (enemy.hp ?? 1); i++) { ctx.fillStyle = '#ffab83'; ctx.fillRect(x + i * 3, y - 5, 2, 0.8); }
        if (enemy.kind === 'sentry' && (enemy.cooldown ?? 110) < 25) glow(x + 6, y + 4, 9, '#ff844f88');
        return;
      }
      ctx.save();
      ctx.shadowColor = '#040810'; ctx.shadowBlur = 4;
      const shell = ctx.createLinearGradient(x, y, x + 12, y + 12);
      shell.addColorStop(0, enemy.flying ? '#edb2db' : '#c0e996');
      shell.addColorStop(0.45, enemy.flying ? '#a64c97' : '#619d67');
      shell.addColorStop(1, enemy.flying ? '#442343' : '#233d37');
      ctx.fillStyle = shell;
      if (enemy.flying) {
        ctx.fillRect(x + 3, y + 3, 7, 4);
        ctx.fillRect(x, y + (frame % 10 < 5 ? 1 : 5), 4, 2);
        ctx.fillRect(x + 10, y + (frame % 10 < 5 ? 1 : 5), 4, 2);
        ctx.fillStyle = '#f5d766';
        ctx.fillRect(x + 8, y + 4, 1, 1);
      } else {
        ctx.fillRect(x + 1, y + 4, 10, 8);
        ctx.fillRect(x + 3, y + 2, 6, 3);
        ctx.fillStyle = '#1d4d56';
        ctx.fillRect(x + 3, y + 9, 2, 3);
        ctx.fillRect(x + 8, y + 9, 2, 3);
        ctx.fillStyle = '#f4edb0';
        ctx.fillRect(x + (enemy.direction > 0 ? 8 : 3), y + 4, 2, 1);
        ctx.fillStyle = '#d6eab180'; ctx.fillRect(x + 3, y + 3, 4, 0.5);
        ctx.fillStyle = '#172c30'; ctx.fillRect(x + 2, y + 7, 8, 0.6);
        ctx.fillStyle = '#93bf83'; ctx.fillRect(x + 5, y + 5, 0.5, 2);
      }
      if (enemy.kind) {
        ctx.fillStyle = enemy.kind === 'sentry' ? '#e9a849' : enemy.kind === 'hunter' ? '#ff6c92' : '#929cbb';
        ctx.fillRect(x + 1, y + 5, 3, 4); ctx.fillRect(x + 8, y + 5, 3, 4);
        ctx.fillStyle = '#f3c37d'; ctx.fillRect(x + 4, y + 6, 4, 1);
        if (enemy.kind === 'sentry') {
          ctx.fillStyle = (enemy.cooldown ?? 110) < 25 ? '#fff0aa' : '#d95746';
          ctx.fillRect(x + (enemy.direction < 0 ? -3 : 10), y + 3, 5, 2);
        }
        for (let i = 0; i < (enemy.hp ?? 1); i++) { ctx.fillStyle = '#ff7469'; ctx.fillRect(x + i * 3, y - 3, 2, 1); }
      }
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff2bc';
      ctx.fillRect(x + (enemy.direction > 0 ? 8 : 3), y + 4, 1.2, 0.6);
      ctx.restore();
    };

    const render = () => {
      const level = levels[levelRef.current];
      const { platforms, spikes } = level;
      const player = playerRef.current;
      const camera = cameraRef.current;
      drawBackground(camera);
      platforms.forEach((platform) => drawPlatform(platform, camera));
      const floor = platforms.find((platform) => player.x + 10 > platform.x && player.x < platform.x + platform.w && platform.y >= player.y + 13);
      if (floor) {
        const distance = floor.y - player.y - 14;
        ctx.save(); ctx.globalAlpha = Math.max(0.08, 0.36 - distance / 180);
        ctx.fillStyle = '#000'; ctx.beginPath();
        ctx.ellipse(player.x - camera + 6, floor.y + 0.5, Math.max(2, 6 - distance / 25), 1, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      spikes.forEach((spike) => {
        const x = spike.x - camera;
        if (x > VIEW_WIDTH || x + spike.w < 0) return;
        if (level.icy) {
          for (let j = 0; j < spike.w; j += 5) {
            ctx.fillStyle = '#87d5ff'; ctx.beginPath(); ctx.moveTo(x + j, spike.y + 8); ctx.lineTo(x + j + 2.5, spike.y); ctx.lineTo(x + j + 5, spike.y + 8); ctx.fill();
            ctx.strokeStyle = '#effaff'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(x + j + 2.5, spike.y); ctx.lineTo(x + j + 2.5, spike.y + 7); ctx.stroke();
          }
          return;
        }
        glow(x + spike.w / 2, spike.y + 5, 18, '#ff762955');
        ctx.save();
        ctx.fillStyle = '#f44817';
        ctx.fillRect(x, spike.y + 6, spike.w, 2);
        for (let point = 0; point < spike.w; point += 5) {
          const width = Math.min(5, spike.w - point);
          const left = x + point;
          const base = spike.y + 8;
          const flicker = Math.sin(timeRef.current * 0.2 + point * 1.7);
          const tip = left + width * (0.5 + flicker * 0.18);
          const top = spike.y + 0.6 + flicker * 0.6;
          ctx.fillStyle = '#ff6922';
          ctx.beginPath(); ctx.moveTo(left, base);
          ctx.bezierCurveTo(left - 0.3, base - 4, tip - 1, top + 4, tip, top);
          ctx.bezierCurveTo(tip + 0.2, top + 4, left + width + 0.5, base - 3, left + width, base);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#ffe467';
          ctx.beginPath(); ctx.moveTo(left + width * 0.2, base);
          ctx.quadraticCurveTo(left + width * 0.3, base - 3, tip, top + 3);
          ctx.quadraticCurveTo(left + width * 0.7, base - 2, left + width * 0.8, base);
          ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      });
      barriersRef.current.forEach(barrier => {
        if (barrier.hp <= 0) return;
        const x = barrier.x - camera;
        ctx.fillStyle = '#72c9f3aa'; ctx.fillRect(x, barrier.y, barrier.w, barrier.h);
        ctx.strokeStyle = '#dcfaff'; ctx.lineWidth = 0.7; ctx.strokeRect(x, barrier.y, barrier.w, barrier.h);
        ctx.beginPath(); ctx.moveTo(x + 3, barrier.y); ctx.lineTo(x + 9, barrier.y + 11); ctx.lineTo(x + 5, barrier.y + 22); ctx.lineTo(x + 11, barrier.y + barrier.h); ctx.stroke();
        for (let i = 0; i < barrier.hp; i++) { ctx.fillStyle = '#c5f4ff'; ctx.fillRect(x + i * 2, barrier.y - 3, 1, 1); }
      });
      iciclesRef.current.forEach(shard => {
        const x = shard.x - camera;
        if (shard.warning) { ctx.fillStyle = '#c3eaff22'; ctx.fillRect(x - 2, shard.y, 7, 176 - shard.y); pixelText(ctx, '!', x + 2, shard.y - 4, '#fff3b0', 'center'); }
        ctx.fillStyle = shard.warning ? '#fff3b0' : '#b6e9ff'; ctx.beginPath(); ctx.moveTo(x, shard.y); ctx.lineTo(x + 6, shard.y); ctx.lineTo(x + 3, shard.y + 12); ctx.closePath(); ctx.fill();
      });
      const boss = enemiesRef.current.find(enemy => enemy.kind === 'frost-king' && enemy.alive);
      if (boss && Math.abs(player.x - boss.x) < 300) {
        ctx.fillStyle = '#071326dd'; ctx.fillRect(85, 6, 150, 17); pixelText(ctx, 'FROST KING', 160, 14, '#c8edff', 'center');
        ctx.fillStyle = '#28415b'; ctx.fillRect(90, 18, 140, 3); ctx.fillStyle = '#a2e5ff'; ctx.fillRect(90, 18, 140 * (boss.hp ?? 0) / 18, 3);
      }
      coresRef.current.forEach((core, index) => {
        if (core.taken) return;
        const x = core.x - camera;
        const y = core.y + Math.sin(timeRef.current / 22 + index) * 1.5;
        glow(x + 5, y + 5, 19, '#55ffe54a');
        ctx.save(); ctx.translate(x + 5, y + 5); ctx.rotate(timeRef.current / 65);
        ctx.strokeStyle = '#64ffe884'; ctx.lineWidth = 0.5; ctx.strokeRect(-6, -6, 12, 12); ctx.restore();
        ctx.fillStyle = '#5effdc'; ctx.beginPath(); ctx.moveTo(x + 5, y); ctx.lineTo(x + 9, y + 5); ctx.lineTo(x + 5, y + 10); ctx.lineTo(x + 1, y + 5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e7fff9'; ctx.beginPath(); ctx.moveTo(x + 5, y); ctx.lineTo(x + 5, y + 7); ctx.lineTo(x + 1, y + 5); ctx.closePath(); ctx.fill();
      });
      enemiesRef.current.forEach((enemy) => { if (enemy.alive) drawEnemy(enemy, camera, timeRef.current); });
      bulletsRef.current.forEach((bullet) => {
        glow(bullet.x - camera, bullet.y, bullet.flame ? 12 : 8, bullet.flame ? '#ff641ccc' : '#ffbb5a90');
        ctx.save(); ctx.strokeStyle = '#ffad56aa'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(bullet.x - camera + (bullet.up ? 1 : 2), bullet.y + (bullet.up ? 2 : 1)); ctx.lineTo(bullet.x - camera + (bullet.up ? 1 : 2 - bullet.direction * 9), bullet.y + (bullet.up ? 11 : 1)); ctx.stroke(); ctx.restore();
        ctx.fillStyle = bullet.flame ? '#ff943d' : '#ffecc0';
        ctx.fillRect(bullet.x - camera, bullet.y, bullet.up ? 2 : 4, bullet.up ? 4 : 2);
      });
      powerupsRef.current.forEach(item => {
        if (item.taken) return;
        const x = item.x - camera;
        const color = item.kind === 'flame' ? '#ff9b48' : item.kind === 'shield' ? '#72beff' : item.kind === 'rapid' ? '#e6a1ff' : '#ff91a4';
        if (x < -20 || x > VIEW_WIDTH + 20) return;
        const bob = Math.sin(timeRef.current / 18 + item.x * 0.04) * 1.2;
        const pulse = 0.65 + Math.sin(timeRef.current / 22 + item.x) * 0.2;
        glow(x + 5, item.y + 4 + bob, 14, color + '55');
        ctx.save(); ctx.globalAlpha = pulse; ctx.strokeStyle = color; ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.ellipse(x + 5, item.y + 12, 7, 1.8, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        const pose = { shield: 0, rapid: 1, life: 2, flame: 3 }[item.kind];
        if (!drawSprite(ctx, pickupSprites, pose, x + 5, item.y + 11 + bob, 14, 1)) {
          ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x + 5, item.y + 5, 3, 0, Math.PI * 2); ctx.fill();
        }
        for (let i = 0; i < 2; i++) {
          const phase = (timeRef.current / 55 + i / 2 + item.x / 200) % 1;
          ctx.save(); ctx.globalAlpha = (1 - phase) * 0.7; ctx.fillStyle = color;
          ctx.fillRect(x + 1 + i * 7, item.y + 8 - phase * 15, 0.7, 0.7); ctx.restore();
        }
      });
      dragonFireRef.current.forEach(fire => {
        const x = fire.x - camera;
        glow(x + 3, fire.y + 3, 11, level.icy ? '#62c9ff88' : '#ff741966');
        ctx.fillStyle = level.icy ? '#8be2ff' : '#ff511c'; ctx.beginPath(); ctx.ellipse(x + 3, fire.y + 3, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = level.icy ? '#ffffff' : '#fff2a2'; ctx.beginPath(); ctx.arc(x + 3, fire.y + 3, 1.6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = level.icy ? '#9ae9ff' : '#ff9b4b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 3, fire.y + 3); ctx.lineTo(x + 3 - fire.vx * 4, fire.y + 3 - fire.vy * 4); ctx.stroke();
      });
      enemyShotsRef.current.forEach(shot => { glow(shot.x - camera, shot.y, 6, '#ff4b4466'); ctx.fillStyle = '#ff6960'; ctx.fillRect(shot.x - camera, shot.y, 4, 2); });
      if (powersRef.current.shield || powersRef.current.grace > 0) {
        ctx.strokeStyle = '#8cdaff'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.ellipse(player.x - camera + 6, player.y + 7, 9, 11, 0, 0, Math.PI * 2); ctx.stroke();
      }
      particles.forEach((particle) => {
        ctx.globalAlpha = particle.life / 30; ctx.fillStyle = particle.color;
        ctx.strokeStyle = particle.color; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(particle.x - camera, particle.y); ctx.lineTo(particle.x - camera - particle.vx * 2.5, particle.y - particle.vy * 2.5); ctx.stroke();
      }); ctx.globalAlpha = 1;
      const gateX = level.gateX - camera;
      const bossAlive = enemiesRef.current.some(enemy => enemy.kind === 'frost-king' && enemy.alive);
      const gateOpen = coresRef.current.every(core => core.taken) && !bossAlive;
      const tint = gateOpen ? '#6affdc' : level.icy ? '#9bd9ff' : '#ff8b55';
      glow(gateX + 10, 157, 35, gateOpen ? '#44ffbf55' : level.icy ? '#73b9ff33' : '#ff5e2825');
      ctx.save();
      const metal = ctx.createLinearGradient(gateX - 5, 0, gateX + 25, 0);
      metal.addColorStop(0, '#2b3949'); metal.addColorStop(0.3, '#afbcc4'); metal.addColorStop(0.5, '#41556a'); metal.addColorStop(1, '#1b2636');
      ctx.fillStyle = metal; ctx.beginPath(); ctx.moveTo(gateX - 4, 176); ctx.lineTo(gateX - 4, 145); ctx.lineTo(gateX + 3, 137); ctx.lineTo(gateX + 17, 137); ctx.lineTo(gateX + 24, 145); ctx.lineTo(gateX + 24, 176); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#07131d'; ctx.beginPath(); ctx.moveTo(gateX + 1, 174); ctx.lineTo(gateX + 1, 147); ctx.lineTo(gateX + 6, 142); ctx.lineTo(gateX + 14, 142); ctx.lineTo(gateX + 19, 147); ctx.lineTo(gateX + 19, 174); ctx.closePath(); ctx.fill();
      if (gateOpen) {
        const energy = ctx.createRadialGradient(gateX + 10, 158, 1, gateX + 10, 158, 17);
        energy.addColorStop(0, '#ecfff6'); energy.addColorStop(0.3, '#70ffd0'); energy.addColorStop(1, '#0a4a59');
        ctx.fillStyle = energy; ctx.fillRect(gateX + 3, 146, 14, 28);
        ctx.strokeStyle = '#ddfff9'; ctx.lineWidth = 0.45;
        for (let i = 0; i < 5; i++) { const phase = (timeRef.current / 80 + i / 5) % 1; ctx.globalAlpha = 1 - phase; ctx.beginPath(); ctx.ellipse(gateX + 10, 159, 2 + phase * 5, 3 + phase * 10, 0, 0, Math.PI * 2); ctx.stroke(); }
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = '#253546'; ctx.fillRect(gateX + 3, 146, 14, 28);
        ctx.strokeStyle = '#0c1722'; ctx.lineWidth = 1;
        for (let y = 149; y < 174; y += 5) { ctx.beginPath(); ctx.moveTo(gateX + 3, y); ctx.lineTo(gateX + 17, y); ctx.stroke(); }
        ctx.fillStyle = level.icy ? '#a2e4ff' : '#ff9c59'; ctx.fillRect(gateX + 9, 146, 2, 28);
      }
      ctx.fillStyle = '#526878'; ctx.fillRect(gateX - 6, 174, 32, 2);
      coresRef.current.forEach((core, i) => { ctx.fillStyle = core.taken ? '#9affdf' : '#623e36'; ctx.fillRect(gateX + 4 + i * 5, 139, 3, 2); });
      ctx.strokeStyle = tint; ctx.lineWidth = 0.8;
      for (const x of [gateX - 2, gateX + 22]) { ctx.beginPath(); ctx.moveTo(x, 149); ctx.lineTo(x, 172); ctx.stroke(); }
      ctx.restore();
      pixelText(ctx, gateOpen ? 'PORTAL READY' : bossAlive ? 'DEFEAT FROST KING' : '3 CORES REQUIRED', gateX + 10, 132, gateOpen ? '#b6ffe9' : '#ffd09e', 'center');
      ctx.save();
      drawHero(player.x - camera, player.y, player.facing, timeRef.current);
      ctx.restore();
      if (gameWonRef.current) {
        ctx.fillStyle = 'rgba(4, 11, 30, 0.78)';
        ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
        pixelText(ctx, `${level.name.toUpperCase()} CLEARED!`, VIEW_WIDTH / 2, 76, '#ffdf77', 'center');
        pixelText(ctx, `SCORE ${scoreRef.current}`, VIEW_WIDTH / 2, 95, '#c6ffed', 'center');
        pixelText(ctx, levelRef.current < levels.length - 1 ? 'ENTER / NEXT LEVEL TO CONTINUE' : 'EXPEDITION COMPLETE! R TO REPLAY', VIEW_WIDTH / 2, 115, '#dbe7ff', 'center');
      }
    };

    const update = () => {
      if (respawnFramesRef.current > 0) { respawnFramesRef.current--; return; }
      timeRef.current += 1;
      if (powersRef.current.grace > 0) powersRef.current.grace--;
      if (!gameWonRef.current && powersRef.current.flame > 0) {
        powersRef.current.flame--;
        if (powersRef.current.flame % 60 === 0) setPowerHud(current => ({ ...current, flame: Math.ceil(powersRef.current.flame / 60) }));
      }
      if (!gameWonRef.current && powersRef.current.rapid > 0) {
        powersRef.current.rapid--;
        if (powersRef.current.rapid % 60 === 0) setPowerHud(current => ({ ...current, rapid: Math.ceil(powersRef.current.rapid / 60) }));
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i]; particle.x += particle.vx; particle.y += particle.vy; particle.vy += 0.035; particle.life--;
        if (particle.life <= 0) particles.splice(i, 1);
      }
      if (!gameWonRef.current) {
        const level = levels[levelRef.current];
        const { platforms, spikes } = level;
        const player = playerRef.current;
        const pressed = pressedRef.current;
        const wasOnFloor = platforms.some((platform) => player.x + 10 > platform.x && player.x < platform.x + platform.w && Math.abs(player.y + 14 - platform.y) < 1.5);
        duckRef.current = wasOnFloor && pressed.has('duck');
        const move = (pressed.has('right') ? 1 : 0) - (pressed.has('left') ? 1 : 0);
        player.vx += move * 0.27;
        player.vx *= level.icy && wasOnFloor ? (duckRef.current ? 0.65 : move === 0 ? 0.975 : 0.96) : move === 0 ? 0.75 : 0.92;
        const speed = duckRef.current ? 0.85 : 2.2;
        player.vx = Math.max(-speed, Math.min(speed, player.vx));
        if (move !== 0) player.facing = move;
        const jumpPressed = pressed.has('jump') && !jumpHeldRef.current;
        jumpHeldRef.current = pressed.has('jump');
        if (jumpPressed && wasOnFloor) { duckRef.current = false; player.vy = -6.7; sound('jump'); }
        player.vy = Math.min(player.vy + 0.38, 7.5);
        const previousBottom = player.y + 14;
        player.x = Math.max(0, Math.min(level.width - 12, player.x + player.vx));
        player.y += player.vy;
        if (player.vy >= 0) {
          for (const platform of platforms) {
            if (player.x + 10 > platform.x && player.x < platform.x + platform.w && previousBottom <= platform.y + 1 && player.y + 14 >= platform.y) {
              player.y = platform.y - 14;
              player.vy = 0;
              break;
            }
          }
        }
        if (player.vy !== 0) duckRef.current = false;
        for (const barrier of barriersRef.current) {
          const bounds = playerBounds(player.x, player.y, duckRef.current);
          if (barrier.hp > 0 && overlap(bounds.x, bounds.y, bounds.w, bounds.h, barrier.x, barrier.y, barrier.w, barrier.h)) {
            player.x = player.x + 5 < barrier.x + barrier.w / 2 ? barrier.x - 11 : barrier.x + barrier.w;
            player.vx = 0;
          }
        }
        const body = playerBounds(player.x, player.y, duckRef.current);
        if (pressed.has('shoot') && shotCooldownRef.current <= 0) {
          const up = pressed.has('aimUp');
          const muzzle = heroMuzzle(player.x, player.y, player.facing, heroPose(player.vx, player.vy, duckRef.current, timeRef.current), up);
          bulletsRef.current.push({ x: muzzle.x - (up ? 1 : 2), y: muzzle.y - (up ? 2 : 1), direction: player.facing, up, flame: powersRef.current.flame > 0 });
          sound('shoot');
          shotCooldownRef.current = powersRef.current.rapid > 0 ? 5 : 14;
        }
        shotCooldownRef.current -= 1;
        bulletsRef.current = bulletsRef.current.map((bullet) => ({ ...bullet, x: bullet.x + (bullet.up ? 0 : bullet.direction * 4.5), y: bullet.y - (bullet.up ? 4.5 : 0) })).filter((bullet) => bullet.x > 0 && bullet.x < level.width && bullet.y > -8);
        for (const enemy of enemiesRef.current) {
          if (!enemy.alive) continue;
          if (enemy.kind === 'dragon' || enemy.kind === 'ice-dragon' || enemy.kind === 'frost-king') {
            const distance = player.x - enemy.x;
            enemy.direction = distance < 0 ? -1 : 1;
            if (Math.abs(distance) < 220) {
              enemy.x = Math.max(enemy.min, Math.min(enemy.max, enemy.x + enemy.direction * (enemy.kind === 'frost-king' ? 0.75 : 0.38)));
              enemy.cooldown = (enemy.cooldown ?? 135) - 1;
              if (enemy.cooldown <= 0) {
                const x = enemy.x + 6 + enemy.direction * 12, y = enemy.y + 3;
                const angle = Math.atan2(player.y + 7 - y, player.x + 6 - x);
                for (const spread of (enemy.kind === 'frost-king' ? [-0.28, -0.14, 0, 0.14, 0.28] : [-0.13, 0, 0.13])) dragonFireRef.current.push({ x, y, vx: Math.cos(angle + spread) * 1.8, vy: Math.sin(angle + spread) * 1.8, life: 125 });
                enemy.cooldown = enemy.kind === 'frost-king' ? ((enemy.hp ?? 18) < 9 ? 80 : 120) : Math.max(115, 165 - levelRef.current * 15);
                sound('shoot');
              }
            }
          } else if (enemy.kind === 'sentry') {
            enemy.direction = player.x < enemy.x ? -1 : 1;
            if (Math.abs(player.x - enemy.x) < 180) {
              enemy.cooldown = (enemy.cooldown ?? 110) - 1;
              if (enemy.cooldown <= 0) { enemyShotsRef.current.push({ x: enemy.x + (enemy.direction < 0 ? -4 : 13), y: enemy.y + 3, direction: enemy.direction }); enemy.cooldown = 110; }
            }
          } else {
            const chase = !enemy.flying && Math.abs(player.x - enemy.x) < 150 && Math.abs(player.y - enemy.y) < 48;
            if (chase) enemy.direction = player.x < enemy.x ? -1 : 1;
            const before = enemy.x;
            enemy.x = Math.max(enemy.min, Math.min(enemy.max, enemy.x + enemy.direction * (chase ? (enemy.kind === 'yeti' ? 1.4 : enemy.kind === 'armored' ? 0.95 : 1.1) : 0.55)));
            enemy.moving = Math.abs(enemy.x - before) > 0.01;
            if (enemy.moving) enemy.animation = (enemy.animation ?? 0) + 1;
            if (!chase && (enemy.x <= enemy.min || enemy.x >= enemy.max)) enemy.direction *= -1;
          }
          const target = enemyBounds(enemy, timeRef.current);
          for (const bullet of bulletsRef.current) {
            if (overlap(bullet.x, bullet.y, bullet.up ? 2 : 4, bullet.up ? 4 : 2, target.x, target.y, target.w, target.h)) {
              if (!enemy.alive) break;
              sound('hit');
              burst(enemy.x + 6, enemy.y + 6, '#ffb45b');
              enemy.hp = (enemy.hp ?? 1) - (bullet.flame ? 3 : powersRef.current.rapid > 0 ? 2 : 1);
              enemy.alive = enemy.hp > 0;
              bullet.x = -99;
              if (!enemy.alive) { scoreRef.current += enemy.kind === 'frost-king' ? 2000 : enemy.kind ? 200 : 100; if (enemy.kind === 'frost-king') setNotice('Frost King defeated! Collect all three cores and enter the portal.'); }
              setHud((current) => ({ ...current, score: scoreRef.current }));
            }
          }
          if (enemy.alive && overlap(body.x, body.y, body.w, body.h, target.x, target.y, target.w, target.h)) { loseLife('Hit by a creature'); return; }
        }
        for (const barrier of barriersRef.current) for (const bullet of bulletsRef.current) {
          if (barrier.hp > 0 && overlap(bullet.x, bullet.y, bullet.up ? 2 : 4, bullet.up ? 4 : 2, barrier.x, barrier.y, barrier.w, barrier.h)) {
            barrier.hp -= bullet.flame ? 3 : 1; bullet.x = -99; sound('hit'); burst(barrier.x + 7, barrier.y + 15, '#b5eaff');
          }
        }
        for (const shard of iciclesRef.current) {
          if (shard.timer > 0) shard.timer--;
          if (!shard.warning && !shard.falling && shard.timer === 0 && Math.abs(player.x - shard.x) < 70) { shard.warning = true; shard.timer = 40; }
          if (shard.warning && shard.timer === 0) { shard.warning = false; shard.falling = true; }
          if (shard.falling) {
            shard.y += 3.4;
            if (overlap(body.x, body.y, body.w, body.h, shard.x, shard.y, 6, 12)) { shard.falling = false; shard.y = 24; shard.timer = 150; loseLife('Hit by a falling icicle'); return; }
            if (shard.y > 185 || platforms.some(p => overlap(shard.x, shard.y, 6, 12, p.x, p.y, p.w, p.h))) { burst(shard.x, shard.y, '#d2f2ff'); shard.falling = false; shard.y = 24; shard.timer = 150; }
          }
        }
        dragonFireRef.current = dragonFireRef.current.map(fire => ({ ...fire, x: fire.x + fire.vx, y: fire.y + fire.vy, life: fire.life - 1 })).filter(fire => fire.life > 0 && fire.x > 0 && fire.x < level.width && fire.y < 192 && !platforms.some(platform => overlap(fire.x, fire.y, 6, 6, platform.x, platform.y, platform.w, platform.h)));
        for (const fire of dragonFireRef.current) {
          if (overlap(body.x, body.y, body.w, body.h, fire.x, fire.y, 6, 6)) { fire.life = 0; if (!level.icy) sound('burn'); loseLife(level.icy ? 'Hit by frost breath' : 'Burned by dragon fire'); return; }
        }
        enemyShotsRef.current = enemyShotsRef.current.map(shot => ({ ...shot, x: shot.x + shot.direction * 2.3 })).filter(shot => shot.x > 0 && shot.x < level.width && !platforms.some(platform => overlap(shot.x, shot.y, 4, 2, platform.x, platform.y, platform.w, platform.h)));
        for (const shot of enemyShotsRef.current) {
          if (overlap(body.x, body.y, body.w, body.h, shot.x, shot.y, 4, 2)) { shot.x = -99; loseLife('Hit by a sentry bolt'); return; }
        }
        powerupsRef.current.forEach(item => {
          if (item.taken || !overlap(body.x, body.y, body.w, body.h, item.x, item.y, 10, 10)) return;
          item.taken = true; sound('core'); burst(item.x + 5, item.y + 5, '#a3caff');
          if (item.kind === 'shield') { powersRef.current.shield = true; setNotice(level.icy ? 'Shield ready: absorbs an enemy or icicle hit. Avoid the abyss.' : 'Shield ready: absorbs one enemy hit. Ground fire and lava still burn.'); }
          if (item.kind === 'flame') { powersRef.current.flame = 900; setNotice('Flame blaster: 15 seconds of triple damage. Melt ice barriers with two shots.'); }
          if (item.kind === 'rapid') { powersRef.current.rapid = 600; setNotice('Overdrive: rapid fire and double damage for 10 seconds.'); }
          if (item.kind === 'life') { livesRef.current = Math.min(3, livesRef.current + 1); setHud(current => ({ ...current, lives: livesRef.current })); setNotice('Repair pack collected. Suit integrity restored by one.'); }
          setPowerHud({ shield: powersRef.current.shield, rapid: Math.ceil(powersRef.current.rapid / 60), flame: Math.ceil(powersRef.current.flame / 60) });
        });
        for (const spike of spikes) {
          if (overlap(body.x + 2, body.y + 2, 8, body.h - 2, spike.x, spike.y, spike.w, 8)) { loseLife(level.icy ? 'Landed on ice spikes' : 'Burned by fire! Jump over it', !level.icy); return; }
        }
        if (player.y + 14 >= 185) { loseLife(level.icy ? 'Fell into the frozen abyss' : 'Fell into the lava', true); return; }
        coresRef.current.forEach((core) => {
          if (!core.taken && overlap(body.x, body.y, body.w, body.h, core.x, core.y, 10, 11)) {
            burst(core.x + 5, core.y + 5, '#66ffe0');
            sound('core');
            core.taken = true;
            scoreRef.current += 250;
            setHud((current) => ({ ...current, cores: coresRef.current.filter((item) => item.taken).length, score: scoreRef.current }));
          }
        });
        if (coresRef.current.every((core) => core.taken) && !enemiesRef.current.some(enemy => enemy.kind === 'frost-king' && enemy.alive) && overlap(body.x, body.y, body.w, body.h, level.gateX, 145, 20, 31)) {
          sound('win');
          gameWonRef.current = true;
          scoreRef.current += 1000;
          setHud({ lives: livesRef.current, cores: 3, score: scoreRef.current, won: true });
        }
        const cameraTarget = Math.max(0, Math.min(level.width - VIEW_WIDTH, player.x - 105));
        cameraRef.current += (cameraTarget - cameraRef.current) * 0.12;
      }
    };
    let lastTime = 0;
    let accumulator = 0;
    const tick = (now: number) => {
      if (document.hidden) { lastTime = now; accumulator = 0; animationFrame = requestAnimationFrame(tick); return; }
      if (lastTime) accumulator += Math.min(now - lastTime, 80);
      lastTime = now;
      while (accumulator >= 1000 / 60) { update(); accumulator -= 1000 / 60; }
      render();
      animationFrame = requestAnimationFrame(tick);
    };

    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [loseLife, sound]);

  const controlProps = (key: string) => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setPressed(key, true, `pointer:${event.pointerId}`);
    },
    onPointerUp: (event: PointerEvent<HTMLButtonElement>) => setPressed(key, false, `pointer:${event.pointerId}`),
    onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => setPressed(key, false, `pointer:${event.pointerId}`),
    onLostPointerCapture: (event: PointerEvent<HTMLButtonElement>) => setPressed(key, false, `pointer:${event.pointerId}`),
  });

  const locationIndex = levels[levelIndex].icy ? 1 : 0;
  const location = locations[locationIndex];
  return (
    <main className={`game-page ${locationIndex === 1 ? 'frozen-location' : ''}`}>
      <section className="game-shell" aria-labelledby="game-title">
        <header className="game-header">
          <div>
            <p className="eyebrow">{location.name.toUpperCase()} · STAGE 0{levelIndex % 3 + 1} / {levels[levelIndex].name.toUpperCase()}</p>
            <h1 id="game-title">Dare Runner</h1>
          </div>
          <div className="status-panel" aria-live="polite">
            <span><Heart size={16} /> <small>SUIT INTEGRITY</small><b>{hud.lives} / 3</b></span>
            <span><Gem size={16} /> <small>POWER CORES</small><b>{hud.cores} / 3</b></span>
            <span><Crosshair size={16} /> <small>SCORE</small><b>{hud.score.toString().padStart(5, '0')}</b></span>
          </div>
        </header>
        <nav className="location-selector" aria-label="Choose a location">
          {locations.map((place, index) => <Button key={place.name} className="restart-button" aria-pressed={locationIndex === index} onClick={() => loadLevel(place.levels[0])}>Location 0{index + 1} · {place.name}</Button>)}
        </nav>
        <section className="location-panel" aria-label="Current location"><div><span className="eyebrow">LOCATION 0{locationIndex + 1}</span><h2>{location.name}</h2><p>{location.description}</p></div><span className="location-badge">{locationIndex === 1 ? '3 stages · Ice dragons & Frost King' : '3 stages · Fire dragons'}</span></section>
        <nav className="level-selector" aria-label="Choose a level">
          {location.levels.map((index, stage) => <Button key={levels[index].name} className="restart-button" aria-pressed={levelIndex === index} onClick={() => loadLevel(index)}>0{stage + 1} · {levels[index].name}</Button>)}
        </nav>
        {locationIndex === 1 && <div className="powerup-hud" aria-live="polite"><span>🔥 {powerHud.flame > 0 ? `Flame blaster ${powerHud.flame}s` : 'Collect flame blasters · melt ice'}</span><span>🛡 {powerHud.shield ? 'Shield ready' : 'Collect a shield'}</span><span>Hold ↓ / S to brake on ice</span></div>}
        {levelIndex === 2 && <div className="powerup-hud" aria-live="polite"><span>🛡 Shield pickup · {powerHud.shield ? 'Shield ready' : 'Collect a shield'}</span><span>⚡ Overdrive pickup · {powerHud.rapid > 0 ? `Overdrive ${powerHud.rapid}s` : '10s rapid fire + double damage'}</span><span>+ · Repair one life</span></div>}
        <div className="screen-topline"><span><i /> EXPEDITION ACTIVE</span><span>{levels[levelIndex].name.toUpperCase()} <b>0{levelIndex % 3 + 1}</b></span></div>
        <div className="screen-frame">
          <canvas ref={canvasRef} width={VIEW_WIDTH * 4} height={VIEW_HEIGHT * 4} aria-label={`Playable Dare Runner level ${levelIndex + 1}: ${levels[levelIndex].name}. Collect three power cores, shoot monsters, and reach the exit.`} />
        </div>
        <div className="game-footer">
          <p><Zap size={18} /><span><strong>{hud.won ? (levelIndex < levels.length - 1 ? `LEVEL ${levelIndex + 1} COMPLETE` : 'EXPEDITION COMPLETE') : 'RESTORE THE EXIT GATE'}</strong>{hud.won ? (levelIndex < levels.length - 1 ? `${levels[levelIndex + 1].name} awaits. Continue to Level ${levelIndex + 2}.` : 'Frozen Citadel cleared. Expedition complete!') : notice}</span></p>
          <div className="game-actions">{hud.won && levelIndex < levels.length - 1 && <Button className="restart-button" onClick={nextLevel}>{levelIndex === 2 ? 'Enter Frozen Citadel →' : 'Next level →'}</Button>}<Button className="restart-button" aria-pressed={muted} onClick={toggleMuted}>{muted ? 'Sound off' : 'Sound on'}</Button>
          <Button className="restart-button" onClick={resetLevel}><RotateCcw size={15} /> Restart level</Button></div>
        </div>
        <div className="instructions" aria-label="Game controls">
          <span><kbd>←</kbd><kbd>→</kbd> or <kbd>A</kbd><kbd>D</kbd> move</span>
          <span><kbd>↑</kbd> or <kbd>W</kbd> jump</span>
          <span><kbd>↓</kbd> / <kbd>S</kbd> hold to duck</span>
          <span><kbd>Space</kbd> / <kbd>X</kbd> fire</span>
          <span><kbd>E</kbd> hold to aim up</span>
          <span><kbd>R</kbd> restart</span>
        </div>
        <div className="touch-controls" aria-label="Touch controls">
          <div className="touch-group">
            <Button variant="outline" aria-label="Move left" {...controlProps('left')}>←</Button>
            <Button variant="outline" aria-label="Move right" {...controlProps('right')}>→</Button>
          </div>
          <div className="touch-group">
            <Button variant="outline" aria-label="Duck" {...controlProps('duck')}>Duck</Button>
            <Button variant="outline" aria-label="Jump" {...controlProps('jump')}>Jump</Button>
            <Button variant="outline" aria-label="Aim upward" {...controlProps('aimUp')}>Aim ↑</Button>
            <Button variant="outline" aria-label="Fire blaster" {...controlProps('shoot')}>Fire</Button>
          </div>
        </div>
      </section>
    </main>
  );
}
