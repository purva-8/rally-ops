import type { ReactNode } from 'react';

// Original stick-figure busts in the spirit of hand-drawn comics: a head, a bit of torso, and
// something to do with the hands. Each person gets a stable random figure from their id.

const INK = '#111827';
const BACKGROUNDS = ['#FED7AA', '#BFDBFE', '#BBF7D0', '#FBCFE8', '#DDD6FE', '#FDE68A', '#A5F3FC', '#FECACA'];

const HAIR: ((k: string) => ReactNode)[] = [
  // bald
  () => null,
  // spiky
  (k) => <path key={k} d="M21 21 L23 11 L27 17 L31 8 L35 17 L40 10 L42 19 L43 22" fill="none" />,
  // ponytail
  (k) => <g key={k} fill="none"><path d="M22 20 Q32 9 42 20" /><path d="M42 18 Q52 20 49 32" /></g>,
  // bun
  (k) => <g key={k} fill="none"><path d="M22 20 Q32 10 42 20" /><circle cx="32" cy="9" r="4" /></g>,
  // cap
  (k) => <g key={k} fill="none"><path d="M21 21 Q32 6 43 21 Z" fill="#fff" /><path d="M43 21 L53 22" /></g>,
  // curly
  (k) => <g key={k} fill="none"><circle cx="24" cy="15" r="4" /><circle cx="32" cy="12" r="4" /><circle cx="40" cy="15" r="4" /></g>,
  // long
  (k) => <g key={k} fill="none"><path d="M21 24 Q20 9 32 10 Q44 9 43 24" /><path d="M21 24 L20 38" /><path d="M43 24 L44 38" /></g>,
];

// Each action draws the arms and any prop. Lines start from the shoulders at (18,50) and (46,50).
const ACTIONS: ((k: string) => ReactNode)[] = [
  // badminton racquet
  (k) => (
    <g key={k} fill="none">
      <path d="M18 50 L14 60" />
      <path d="M46 50 L52 38" />
      <path d="M52 38 L56 30" />
      <ellipse cx="58" cy="24" rx="4.5" ry="7" transform="rotate(25 58 24)" fill="#fff" />
    </g>
  ),
  // waving
  (k) => (
    <g key={k} fill="none">
      <path d="M18 50 L14 60" />
      <path d="M46 50 L53 36" />
      <circle cx="53" cy="33" r="3" fill="#fff" />
      <path d="M58 30 L60 28 M59 35 L62 35" />
    </g>
  ),
  // waving a flag
  (k) => (
    <g key={k} fill="none">
      <path d="M18 50 L14 60" />
      <path d="M46 50 L51 41" />
      <circle cx="51" cy="38" r="2.6" fill="#fff" />
      <path d="M51 35 L51 14" />
      <path d="M51 14 L61 18 L51 22 Z" fill="#fff" />
    </g>
  ),
  // shrug
  (k) => (
    <g key={k} fill="none">
      <path d="M18 50 L9 44" />
      <path d="M46 50 L55 44" />
      <path d="M9 44 L6 40 M9 44 L6 46 M55 44 L58 40 M55 44 L58 46" />
    </g>
  ),
  // trophy
  (k) => (
    <g key={k} fill="none">
      <path d="M18 50 L14 60" />
      <path d="M46 50 L50 42" />
      <path d="M46 26 L46 33 Q50 38 54 33 L54 26 Z" fill="#fff" />
      <path d="M50 37 L50 42 M46 42 L54 42" />
      <path d="M46 28 Q42 28 43 31 Q44 33 46 32 M54 28 Q58 28 57 31 Q56 33 54 32" />
    </g>
  ),
  // coffee mug with steam
  (k) => (
    <g key={k} fill="none">
      <path d="M18 50 L14 60" />
      <path d="M46 50 L47 45" />
      <rect x="43" y="37" width="10" height="9" rx="1.5" fill="#fff" />
      <path d="M53 39 Q57 39 57 42 Q57 45 53 44" />
      <path d="M46 34 Q44 31 46 29 M50 34 Q48 31 50 29" />
    </g>
  ),
  // holding a shuttlecock
  (k) => (
    <g key={k} fill="none">
      <path d="M18 50 L14 60" />
      <path d="M46 50 L51 40" />
      <circle cx="51" cy="37" r="2.5" fill="#fff" />
      <path d="M49 34 L46 25 M51 34 L51 24 M53 34 L56 25" />
      <path d="M46 25 Q51 22 56 25" />
    </g>
  ),
  // flexing
  (k) => (
    <g key={k} fill="none">
      <path d="M18 50 L9 46 L11 36" />
      <path d="M46 50 L55 46 L53 36" />
      <circle cx="11" cy="34" r="2.5" fill="#fff" />
      <circle cx="53" cy="34" r="2.5" fill="#fff" />
    </g>
  ),
  // coach whistle
  (k) => (
    <g key={k} fill="none">
      <path d="M18 50 L14 60" />
      <path d="M46 50 L50 60" />
      <path d="M27 41 L32 54 L37 41" />
      <circle cx="32" cy="56" r="3.5" fill="#fff" />
      <path d="M35 56 L40 56" />
    </g>
  ),
  // clipboard
  (k) => (
    <g key={k} fill="none">
      <path d="M18 50 L14 60" />
      <path d="M46 50 L44 56" />
      <rect x="36" y="46" width="16" height="16" rx="1.5" fill="#fff" />
      <path d="M40 51 L48 51 M40 55 L48 55 M40 59 L45 59" />
    </g>
  ),
  // peace sign
  (k) => (
    <g key={k} fill="none">
      <path d="M18 50 L14 60" />
      <path d="M46 50 L52 40" />
      <circle cx="52" cy="37" r="2.6" fill="#fff" />
      <path d="M51 35 L48 28 M53 35 L56 28" />
    </g>
  ),
  // both hands up, cheering
  (k) => (
    <g key={k} fill="none">
      <path d="M18 50 L10 38 L8 28" />
      <path d="M46 50 L54 38 L56 28" />
      <path d="M6 26 L8 28 L10 26 M54 26 L56 28 L58 26" />
    </g>
  ),
  // headphones
  (k) => (
    <g key={k} fill="none">
      <path d="M18 50 L14 60" />
      <path d="M46 50 L50 60" />
      <path d="M20 26 Q20 10 32 10 Q44 10 44 26" />
      <rect x="17" y="24" width="5" height="9" rx="2" fill="#fff" />
      <rect x="42" y="24" width="5" height="9" rx="2" fill="#fff" />
    </g>
  ),
];

// FNV-1a then a finaliser, so similar ids still land on very different figures
function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

const pick = (h: number, salt: number, n: number) => {
  let x = Math.imul(h ^ salt, 0x9e3779b1);
  x ^= x >>> 15;
  return (x >>> 0) % n;
};

export const ACTION_NAMES = ['racquet', 'wave', 'flag', 'shrug', 'trophy', 'coffee', 'shuttlecock', 'flex', 'whistle', 'clipboard', 'peace', 'cheer', 'headphones'];

export default function Avatar({ seed, size = 64, className = '', variant }: { seed: string; size?: number; className?: string; variant?: number }) {
  const h = hash(seed || 'x');
  const bg = BACKGROUNDS[pick(h, 1, BACKGROUNDS.length)];
  const action = ACTIONS[variant ?? pick(h, 2, ACTIONS.length)];
  const hair = HAIR[pick(h, 3, HAIR.length)];
  const smile = pick(h, 4, 3); // 0 smile, 1 grin, 2 straight

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      style={{ borderRadius: size * 0.28, background: bg }}
      role="img"
      aria-hidden
    >
      <g stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* torso and neck */}
        <path d="M32 35 L32 41" />
        <path d="M10 66 Q12 44 32 42 Q52 44 54 66" />
        {/* head */}
        <circle cx="32" cy="24" r="11" fill="#fff" />
        {hair('hair')}
        {/* face */}
        <circle cx="28" cy="23" r="1.1" fill={INK} stroke="none" />
        <circle cx="36" cy="23" r="1.1" fill={INK} stroke="none" />
        {smile === 0 && <path d="M28 28 Q32 31 36 28" strokeWidth="1.6" />}
        {smile === 1 && <path d="M27.5 27.5 Q32 33 36.5 27.5 Z" strokeWidth="1.4" fill="#fff" />}
        {smile === 2 && <path d="M28.5 29 L35.5 29" strokeWidth="1.6" />}
        {action('action')}
      </g>
    </svg>
  );
}
