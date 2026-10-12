import { cuisineFamily, type Family } from './cuisines';

/**
 * Gestileerde "foto": een bord met een motief per keukenfamilie en de beginletter van de naam.
 * Geen stockfoto's (rechten) en geen Google-foto's (vereist betaalde API).
 */
const ART: Record<Family, { bg: string; ink: string; motif: (c: string) => React.ReactNode }> = {
  asian: {
    bg: '#2a1a2e',
    ink: '#ff8fa3',
    motif: (c) => (
      <>
        <path d="M30 62 h60 a30 22 0 0 1 -60 0z" fill={c} opacity=".9" />
        <path d="M72 24 L52 60 M82 26 L58 61" stroke={c} strokeWidth="3" strokeLinecap="round" />
      </>
    ),
  },
  italian: {
    bg: '#2b2014',
    ink: '#f2b84b',
    motif: (c) => (
      <>
        <path d="M60 22 L90 78 Q60 90 30 78 Z" fill={c} opacity=".9" />
        <circle cx="58" cy="55" r="5" fill="#0c1220" opacity=".5" />
        <circle cx="70" cy="68" r="4" fill="#0c1220" opacity=".5" />
        <circle cx="50" cy="70" r="4" fill="#0c1220" opacity=".5" />
      </>
    ),
  },
  shared: {
    bg: '#14262a',
    ink: '#5ed3c8',
    motif: (c) => (
      <>
        <circle cx="42" cy="48" r="14" fill="none" stroke={c} strokeWidth="4" />
        <circle cx="78" cy="48" r="14" fill="none" stroke={c} strokeWidth="4" />
        <circle cx="60" cy="76" r="14" fill="none" stroke={c} strokeWidth="4" />
      </>
    ),
  },
  grill: {
    bg: '#2e1714',
    ink: '#ff7a4d',
    motif: (c) => (
      <path
        d="M60 20 C74 40 86 50 80 70 A20 20 0 0 1 40 70 C36 56 46 50 50 38 C54 50 60 52 60 20Z"
        fill={c}
        opacity=".9"
      />
    ),
  },
  green: {
    bg: '#15261b',
    ink: '#5ed39b',
    motif: (c) => (
      <>
        <path d="M30 80 C30 40 70 24 92 26 C92 56 72 82 30 80Z" fill={c} opacity=".9" />
        <path d="M34 78 L80 34" stroke="#0c1220" strokeWidth="3" opacity=".5" />
      </>
    ),
  },
  world: {
    bg: '#1d1a2e',
    ink: '#b4a2ff',
    motif: (c) => (
      <>
        <circle cx="60" cy="54" r="30" fill="none" stroke={c} strokeWidth="4" />
        <path
          d="M30 54 h60 M60 24 c-16 18 -16 42 0 60 c16 -18 16 -42 0 -60"
          fill="none"
          stroke={c}
          strokeWidth="3"
        />
      </>
    ),
  },
  european: {
    bg: '#1a2133',
    ink: '#a3c4ff',
    motif: (c) => (
      <>
        <path
          d="M44 22 v26 a6 6 0 0 0 12 0 v-26 M50 48 v40"
          stroke={c}
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M74 22 c-10 10 -10 30 0 34 v32"
          stroke={c}
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
      </>
    ),
  },
  quick: {
    bg: '#222',
    ink: '#d9d9d9',
    motif: (c) => <circle cx="60" cy="54" r="24" fill={c} opacity=".7" />,
  },
};

export function CuisineArt({ name, cuisine }: { name: string; cuisine?: string }) {
  const a = ART[cuisineFamily(cuisine)];
  const letter =
    name
      .replace(/^[^A-Za-zÀ-ÿ0-9]+/, '')
      .charAt(0)
      .toUpperCase() || '·';
  return (
    <svg
      viewBox="0 0 120 120"
      className="h-28 w-28 shrink-0 rounded-2xl sm:h-32 sm:w-32"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="120" height="120" fill={a.bg} />
      <circle cx="60" cy="56" r="44" fill="#0c1220" opacity=".35" />
      {a.motif(a.ink)}
      <text
        x="104"
        y="108"
        textAnchor="end"
        fontFamily="Bricolage Grotesque Variable, sans-serif"
        fontWeight="800"
        fontSize="30"
        fill={a.ink}
      >
        {letter}
      </text>
    </svg>
  );
}
