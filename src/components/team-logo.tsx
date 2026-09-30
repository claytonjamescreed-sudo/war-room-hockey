// A badge for every pool team, each a joke on the team's name. Drawn on a 48x48 grid inside a
// round crest; teams are matched by their locker name, so old spellings and "TW3" get theirs.
// A team with no badge yet gets its initials.
import { useId, type ReactNode } from "react";
import { historyName } from "@/lib/history";

type Badge = { bg: string; art: ReactNode };

const INK = "#1A1614";
const GOLD = "#FFB81C";
const WHITE = "#FFFFFF";

// A heart with its point at 0,0 and its lobes up, for the shamrock
const LEAF = "M0 0C-2-2.5-7-3.5-7-8.5-7-11.5-3-12.5 0-9.5 3-12.5 7-11.5 7-8.5 7-3.5 2-2.5 0 0Z";

const BADGES: Record<string, Badge> = {
  // The ace of spades
  ACE: {
    bg: "#C8102E",
    art: (
      <>
        <rect
          x="14"
          y="8"
          width="20"
          height="30"
          rx="3"
          fill={WHITE}
          transform="rotate(-8 24 23)"
        />
        <path
          d="M24 15C24 15 16.5 21.5 16.5 26 16.5 29.5 20 31 22.6 28.8L21.3 33H26.7L25.4 28.8C28 31 31.5 29.5 31.5 26 31.5 21.5 24 15 24 15Z"
          fill={INK}
          transform="rotate(-8 24 23)"
        />
        <text
          x="15.5"
          y="15.5"
          fontSize="7"
          fontWeight="900"
          fontFamily="Arial,sans-serif"
          fill="#C8102E"
          transform="rotate(-8 24 23)"
        >
          A
        </text>
      </>
    ),
  },
  // A light bulb with a zigzag filament
  LiteMan: {
    bg: "#3949AB",
    art: (
      <>
        <g stroke="#FFE27A" strokeWidth="2.2" strokeLinecap="round">
          <line x1="24" y1="4.5" x2="24" y2="7.5" />
          <line x1="12.5" y1="9" x2="14.6" y2="11.1" />
          <line x1="35.5" y1="9" x2="33.4" y2="11.1" />
          <line x1="8" y1="20" x2="11" y2="20" />
          <line x1="40" y1="20" x2="37" y2="20" />
        </g>
        <path d="M24 10a9.5 9.5 0 0 0-5.5 17.2V30h11v-2.8A9.5 9.5 0 0 0 24 10Z" fill="#FFD34D" />
        <path
          d="M20.5 22l1.75 2.5 1.75-2.5 1.75 2.5 1.75-2.5"
          fill="none"
          stroke="#B8860B"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        <rect x="19" y="30.5" width="10" height="6" rx="1.5" fill="#CFD5DD" />
        <path d="M19.5 32.5h9M19.5 34.5h9" stroke="#8C96A3" strokeWidth="1" />
        <rect x="21.5" y="37" width="5" height="2" rx="1" fill="#8C96A3" />
      </>
    ),
  },
  // A grinning pickle
  Pickledish: {
    bg: "#7E57C2",
    art: (
      <g transform="rotate(35 24 24)">
        <ellipse cx="24" cy="24" rx="9" ry="17" fill="#5DAA32" stroke="#2F6B1A" strokeWidth="1.6" />
        <g fill="#2F6B1A">
          <circle cx="19" cy="13" r="1.1" />
          <circle cx="28.5" cy="16" r="1.1" />
          <circle cx="18.5" cy="33" r="1.1" />
          <circle cx="29" cy="31" r="1.1" />
          <circle cx="24" cy="36.5" r="1.1" />
        </g>
        <g transform="rotate(-35 24 24)">
          <circle cx="20.5" cy="21.5" r="2.6" fill={WHITE} />
          <circle cx="27.5" cy="21.5" r="2.6" fill={WHITE} />
          <circle cx="21" cy="22" r="1.3" fill={INK} />
          <circle cx="28" cy="22" r="1.3" fill={INK} />
          <path
            d="M19.5 27q4.5 4 9 0"
            fill="none"
            stroke={INK}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </g>
      </g>
    ),
  },
  // The goal light, on
  Redlight: {
    bg: "#16181D",
    art: (
      <>
        <g stroke="#FF4D4D" strokeWidth="2.2" strokeLinecap="round">
          <line x1="24" y1="4.5" x2="24" y2="8.5" />
          <line x1="11" y1="9.5" x2="13.8" y2="12.3" />
          <line x1="37" y1="9.5" x2="34.2" y2="12.3" />
          <line x1="6.5" y1="21" x2="10.5" y2="21" />
          <line x1="41.5" y1="21" x2="37.5" y2="21" />
        </g>
        <path d="M14.5 31V23a9.5 9.5 0 0 1 19 0v8Z" fill="#E4002B" />
        <path
          d="M18 22.5a6 6 0 0 1 4-5.2"
          fill="none"
          stroke="#FF9A9A"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <rect x="11.5" y="31" width="25" height="6" rx="1.5" fill="#B7BEC7" />
        <rect x="11.5" y="35" width="25" height="2" rx="1" fill="#7D8691" />
      </>
    ),
  },
  // A rabbit with buck teeth
  Rogersrabbits: {
    bg: "#2A9D8F",
    art: (
      <>
        <ellipse cx="18.5" cy="13" rx="4" ry="10" fill={WHITE} transform="rotate(-14 18.5 13)" />
        <ellipse cx="29.5" cy="13" rx="4" ry="10" fill={WHITE} transform="rotate(14 29.5 13)" />
        <ellipse
          cx="18.5"
          cy="13.5"
          rx="1.8"
          ry="7"
          fill="#F4A6B8"
          transform="rotate(-14 18.5 13.5)"
        />
        <ellipse
          cx="29.5"
          cy="13.5"
          rx="1.8"
          ry="7"
          fill="#F4A6B8"
          transform="rotate(14 29.5 13.5)"
        />
        <circle cx="24" cy="29" r="10.5" fill={WHITE} />
        <circle cx="20" cy="27" r="1.6" fill={INK} />
        <circle cx="28" cy="27" r="1.6" fill={INK} />
        <ellipse cx="24" cy="30.5" rx="1.8" ry="1.3" fill="#F28AA0" />
        <path d="M24 31.8v1.4" stroke={INK} strokeWidth="1" />
        <rect
          x="21.9"
          y="33.2"
          width="4.2"
          height="3.6"
          rx=".8"
          fill={WHITE}
          stroke={INK}
          strokeWidth=".9"
        />
        <path d="M24 33.2v3.6" stroke={INK} strokeWidth=".8" />
        <g stroke="#9AA5A3" strokeWidth=".8" strokeLinecap="round">
          <path d="M18.5 31l-5-1M18.5 32.5l-5 1M29.5 31l5-1M29.5 32.5l5 1" />
        </g>
      </>
    ),
  },
  // A wheel at speed
  "The Wheeler": {
    bg: "#F57C00",
    art: (
      <>
        <g stroke={WHITE} strokeWidth="2.4" strokeLinecap="round">
          <line x1="5.5" y1="17" x2="12" y2="17" />
          <line x1="4" y1="24" x2="11.5" y2="24" />
          <line x1="5.5" y1="31" x2="12" y2="31" />
        </g>
        <circle cx="27" cy="24" r="12" fill={INK} />
        <circle cx="27" cy="24" r="7.5" fill="#D9DEE4" />
        <g stroke={INK} strokeWidth="1.6">
          <line x1="27" y1="24" x2="27" y2="16.5" />
          <line x1="27" y1="24" x2="34.1" y2="21.7" />
          <line x1="27" y1="24" x2="31.4" y2="30.1" />
          <line x1="27" y1="24" x2="22.6" y2="30.1" />
          <line x1="27" y1="24" x2="19.9" y2="21.7" />
        </g>
        <circle cx="27" cy="24" r="2.3" fill={GOLD} stroke={INK} strokeWidth="1" />
      </>
    ),
  },
  // A breaking wave
  Brayker: {
    bg: "#0288D1",
    art: (
      <>
        <path
          d="M4 36C9 36 12 32 15 26 19 17 25 12 32 12 39 12 43 17 42 22 41 27 35 28 32.5 25 30.5 22.5 32 19 35 19.5 31 16 25 18 22 25 19 31 17 36 21 40H4Z"
          fill={WHITE}
        />
        <path d="M4 34.5Q10 31 16 34.5T28 34.5 40 34.5 46 34.5V46H4Z" fill="#01579B" />
        <path
          d="M4 38.5Q10 35.5 16 38.5T28 38.5 40 38.5"
          fill="none"
          stroke="#4FC3F7"
          strokeWidth="1.5"
        />
      </>
    ),
  },
  // A longhorn steer, cartoon style
  Longhorn: {
    bg: "#BF5700",
    art: (
      <>
        <path
          d="M3.5 15C7 22 13 22.5 18 20.5L30 20.5C35 22.5 41 22 44.5 15 42.5 24 36 26.5 30 25L18 25C12 26.5 5.5 24 3.5 15Z"
          fill="#F6E7CF"
        />
        <path d="M17.5 21H30.5L29 32Q27.5 38 24 38 20.5 38 19 32Z" fill="#F6E7CF" />
        <ellipse cx="24" cy="34.5" rx="4.2" ry="2.8" fill="#E9C9A5" />
        <circle cx="22.4" cy="34.5" r=".9" fill={INK} />
        <circle cx="25.6" cy="34.5" r=".9" fill={INK} />
        <circle cx="21" cy="26" r="1.4" fill={INK} />
        <circle cx="27" cy="26" r="1.4" fill={INK} />
      </>
    ),
  },
  // Guns: a flexed arm
  "The Gunz": {
    bg: "#455A64",
    art: (
      <>
        <path
          d="M4.5 42V31C6.5 25 11 21.5 16.5 21.5 21.5 21.5 25.5 23.5 28 27V19.5C26.5 19 25.5 17.5 25.8 15.5L26.5 11.5C27 9 29 7.5 31.5 7.5H36.5C39.5 7.5 41.5 9.5 41.5 12.5V17C41.5 18.5 40.8 19.5 40 20V35C40 38.5 37.5 42 34 42Z"
          fill={GOLD}
          stroke={INK}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M30 12.5H36M29.5 16H35.5M12 28.5C15 26 19.5 25.8 22.5 28"
          fill="none"
          stroke={INK}
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <path
          d="M13 32.5C16 30.5 20 30.5 23 32.5"
          fill="none"
          stroke="#FFE39A"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </>
    ),
  },
  // Uno más, one more: a foam finger
  Unomas: {
    bg: GOLD,
    art: (
      <>
        <rect x="20.5" y="5.5" width="7" height="17" rx="3.5" fill="#E4002B" />
        <path
          d="M14 21.5a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4V31a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4Z"
          fill="#E4002B"
        />
        <ellipse cx="13.5" cy="25" rx="3" ry="4.5" fill="#E4002B" transform="rotate(-25 13.5 25)" />
        <rect x="16" y="34" width="16" height="7" rx="1.5" fill={WHITE} />
        <text
          x="24"
          y="31.5"
          textAnchor="middle"
          fontSize="11"
          fontWeight="900"
          fontFamily="Arial,sans-serif"
          fill={WHITE}
        >
          +1
        </text>
      </>
    ),
  },
  // A tuque with a pompom
  "Jean Guy": {
    bg: "#1A237E",
    art: (
      <>
        <circle cx="24" cy="10.5" r="4.5" fill={WHITE} />
        <path d="M12.5 30a11.5 12.5 0 0 1 23 0Z" fill="#E4002B" />
        <rect x="12.5" y="21.5" width="23" height="3.5" fill={WHITE} />
        <rect x="11" y="29" width="26" height="7.5" rx="2" fill={WHITE} />
        <path
          d="M14 29.5v6.5M17 29.5v6.5M20 29.5v6.5M23 29.5v6.5M26 29.5v6.5M29 29.5v6.5M32 29.5v6.5M35 29.5v6.5"
          stroke="#C5CAE9"
          strokeWidth="1"
        />
      </>
    ),
  },
  // King and queen: two crowns
  "King Bob & Queen Marie": {
    bg: "#5E2B7E",
    art: (
      <>
        <path d="M7 31V16l5 5.5 4.5-8 4.5 8 5-5.5V31Z" fill={GOLD} stroke={INK} strokeWidth="1" />
        <path
          d="M22 36V24.5l4 4.2 4-6.2 4 6.2 4-4.2V36Z"
          fill="#FFD9A0"
          stroke={INK}
          strokeWidth="1"
        />
        <circle cx="16.5" cy="26" r="1.8" fill="#E4002B" />
        <circle cx="30" cy="32" r="1.5" fill="#3D8BFD" />
        <circle cx="12" cy="20.5" r="1" fill={WHITE} />
        <circle cx="16.5" cy="13" r="1" fill={WHITE} />
        <circle cx="21" cy="20.5" r="1" fill={WHITE} />
      </>
    ),
  },
  // A frothy mug
  Mugzy: {
    bg: "#1F6E43",
    art: (
      <>
        <path
          d="M31 20h3.5a4 4 0 0 1 4 4v5a4 4 0 0 1-4 4H31"
          fill="none"
          stroke="#E8E2D0"
          strokeWidth="3"
        />
        <rect x="12" y="17" width="20" height="21" rx="2.5" fill={GOLD} />
        <path
          d="M17 21v13M22 21v13M27 21v13"
          stroke="#FFD66B"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <g fill={WHITE}>
          <circle cx="14.5" cy="16.5" r="4" />
          <circle cx="20.5" cy="14" r="5" />
          <circle cx="27" cy="15" r="4.5" />
          <circle cx="31" cy="18" r="3" />
          <rect x="12" y="16" width="20" height="4" />
        </g>
      </>
    ),
  },
  // A happy tater tot and a dab of ketchup
  "Tater Tot": {
    bg: "#2B2D42",
    art: (
      <>
        <rect
          x="11"
          y="15"
          width="24"
          height="19"
          rx="7"
          fill="#E9A93A"
          stroke="#B26B12"
          strokeWidth="1.5"
        />
        <g fill="#C98522">
          <circle cx="15.5" cy="19" r=".9" />
          <circle cx="30.5" cy="19.5" r=".9" />
          <circle cx="31.5" cy="29" r=".9" />
          <circle cx="15" cy="29.5" r=".9" />
        </g>
        <circle cx="20" cy="23" r="1.5" fill={INK} />
        <circle cx="27" cy="23" r="1.5" fill={INK} />
        <path
          d="M20 27.5q3.5 3 7 0"
          fill="none"
          stroke={INK}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M36.5 26c0 0-3.5 4-3.5 6.3a3.5 3.5 0 0 0 7 0C40 30 36.5 26 36.5 26Z"
          fill="#E4002B"
        />
      </>
    ),
  },
  // Right down the middle of the bell curve
  "Team Average": {
    bg: "#AD1457",
    art: (
      <>
        <path d="M6 35C13 35 15.5 13 24 13S35 35 42 35Z" fill={WHITE} opacity=".22" />
        <path
          d="M6 35C13 35 15.5 13 24 13S35 35 42 35"
          fill="none"
          stroke={WHITE}
          strokeWidth="2.4"
        />
        <line
          x1="24"
          y1="11"
          x2="24"
          y2="37"
          stroke={GOLD}
          strokeWidth="2"
          strokeDasharray="2.5 2"
        />
        <line x1="6" y1="35.5" x2="42" y2="35.5" stroke={WHITE} strokeWidth="1.5" />
      </>
    ),
  },
  // A fleur-de-lis
  "Team MTL": {
    bg: "#1D3F8F",
    art: (
      <g fill={WHITE}>
        <path d="M24 6.5C19.5 11.5 19 18.5 24 26.5 29 18.5 28.5 11.5 24 6.5Z" />
        <path d="M22.3 27.5C19.5 20.5 12.5 17.5 9.5 21.5 7.5 24.5 9.5 28.5 13.5 27.5 11.5 26.5 12 23.5 14.5 23.5 17.5 23.5 20 25.5 21 28Z" />
        <path d="M25.7 27.5C28.5 20.5 35.5 17.5 38.5 21.5 40.5 24.5 38.5 28.5 34.5 27.5 36.5 26.5 36 23.5 33.5 23.5 30.5 23.5 28 25.5 27 28Z" />
        <rect x="15" y="27" width="18" height="3.2" rx="1.2" />
        <path d="M21.5 30.2 24 41.5 26.5 30.2ZM19.5 30.2C18 33 16 34 14 34.5 16.5 36 19.5 35 21 32ZM28.5 30.2C30 33 32 34 34 34.5 31.5 36 28.5 35 27 32Z" />
      </g>
    ),
  },
  // e to the g
  "E to the G MTL": {
    bg: "#7B1E2B",
    art: (
      <>
        <text
          x="21"
          y="37"
          textAnchor="middle"
          fontSize="30"
          fontWeight="900"
          fontFamily="Georgia,serif"
          fontStyle="italic"
          fill={WHITE}
        >
          e
        </text>
        <text
          x="33"
          y="21"
          textAnchor="middle"
          fontSize="16"
          fontWeight="900"
          fontFamily="Georgia,serif"
          fontStyle="italic"
          fill={GOLD}
        >
          g
        </text>
      </>
    ),
  },
  // Bo knows: a wise old owl
  "Bo Knows": {
    bg: "#00695C",
    art: (
      <>
        <path d="M13 16 12 8.5 19 13ZM35 16 36 8.5 29 13Z" fill="#8D6E63" />
        <ellipse cx="24" cy="26" rx="12.5" ry="13" fill="#A1887F" />
        <ellipse cx="24" cy="31" rx="7" ry="7" fill="#D7CCC8" />
        <circle cx="19" cy="21.5" r="5.2" fill={WHITE} stroke="#6D4C41" strokeWidth="1.2" />
        <circle cx="29" cy="21.5" r="5.2" fill={WHITE} stroke="#6D4C41" strokeWidth="1.2" />
        <circle cx="19.5" cy="22" r="2.4" fill={INK} />
        <circle cx="28.5" cy="22" r="2.4" fill={INK} />
        <path d="M22 26h4l-2 3.5Z" fill={GOLD} />
      </>
    ),
  },
  // A kaiju with a mouth full of teeth
  Bzilla: {
    bg: "#212121",
    art: (
      <>
        <path
          d="M11 20 8.5 14 14 17ZM13.5 14.5 12.5 8 17.5 12.5ZM18 11 18.5 5 22 10.5Z"
          fill="#AED581"
        />
        <path
          d="M9 40V27C9 17.5 15 11 24 11H31C36 11 40 14 40 18.5V21L33 22.5 39 25V28C39 30 37.5 31 35.5 31H29L26 40Z"
          fill="#7CB342"
        />
        <path
          d="M33 22.5 38.5 24.8M33.5 22.4 35 24.3 36.2 22.2 37.6 24.5"
          fill="none"
          stroke={WHITE}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <circle cx="30" cy="16" r="2.6" fill="#FFEB3B" />
        <circle cx="30.6" cy="16" r="1.2" fill={INK} />
        <path d="M27 13.2 33 14" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="38" cy="15" r=".8" fill={INK} />
      </>
    ),
  },
  // A founding father's moustache
  "Barry McCokn’r": {
    bg: "#E8D5B0",
    art: (
      <>
        <circle cx="24" cy="18.5" r="5" fill="#E0A07E" />
        <circle cx="22.5" cy="17" r="1.4" fill="#F2C2A5" />
        <path
          d="M24 24C21 20 15 20.5 12.5 24.5 11 27 7.5 26.5 6.5 23 5.5 29.5 11.5 33.5 17 31 20 29.8 22.5 28 24 26.5 25.5 28 28 29.8 31 31 36.5 33.5 42.5 29.5 41.5 23 40.5 26.5 37 27 35.5 24.5 33 20.5 27 20 24 24Z"
          fill="#4E342E"
        />
      </>
    ),
  },
  // An ice resurfacer with a bow on top
  "Zamboni Lady": {
    bg: "#2E86DE",
    art: (
      <>
        <rect x="8.5" y="19" width="23" height="13" rx="2" fill={WHITE} />
        <rect
          x="27"
          y="12.5"
          width="11"
          height="13"
          rx="2"
          fill="#BFE6FA"
          stroke={WHITE}
          strokeWidth="1.6"
        />
        <rect x="8.5" y="30" width="31" height="3" rx="1" fill="#E4002B" />
        <circle cx="15" cy="34.5" r="3.6" fill={INK} />
        <circle cx="32" cy="34.5" r="3.6" fill={INK} />
        <circle cx="15" cy="34.5" r="1.3" fill="#9E9E9E" />
        <circle cx="32" cy="34.5" r="1.3" fill="#9E9E9E" />
        <path d="M32.5 12.5 28.5 9.5V14ZM32.5 12.5 36.5 9.5V14Z" fill="#FF69B4" />
        <circle cx="32.5" cy="12" r="1.3" fill="#FF69B4" />
        <path d="M5 39.5h38" stroke="#E3F2FD" strokeWidth="1.6" strokeLinecap="round" />
      </>
    ),
  },
  // A shamrock
  "McCarthy's squad": {
    bg: "#00843D",
    art: (
      <>
        <path
          d="M24 23c1 6 3.5 11 8 15"
          fill="none"
          stroke={WHITE}
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <g fill={WHITE}>
          <path d={LEAF} transform="translate(24 23)" />
          <path d={LEAF} transform="translate(24 23) rotate(120)" />
          <path d={LEAF} transform="translate(24 23) rotate(240)" />
        </g>
      </>
    ),
  },
  // Giant killer: a slingshot
  Parker: {
    bg: "#4FC3F7",
    art: (
      <>
        <path
          d="M24 40V27M24 27 16 12M24 27 32 12"
          fill="none"
          stroke="#6D4C41"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M16.5 13.5Q24 25 31.5 13.5" fill="none" stroke="#E4002B" strokeWidth="1.8" />
        <circle cx="24" cy="18.5" r="3" fill="#9E9E9E" stroke={INK} strokeWidth="1" />
      </>
    ),
  },
  // Pumbaa's side of the double act: a warthog
  "Timonen Pumba": {
    bg: "#F4A261",
    art: (
      <>
        <path d="M13 17 9 9.5 17.5 13ZM35 17 39 9.5 30.5 13Z" fill="#6D4C41" />
        <path d="M21 11.5 22.5 8 24 11 25.5 8 27 11.5Z" fill="#4E342E" />
        <ellipse cx="24" cy="23" rx="12" ry="11" fill="#8D6E63" />
        <ellipse cx="24" cy="31" rx="7.5" ry="5.5" fill="#D7A58F" />
        <ellipse cx="21.5" cy="31" rx="1.3" ry="1.8" fill="#4E342E" />
        <ellipse cx="26.5" cy="31" rx="1.3" ry="1.8" fill="#4E342E" />
        <path
          d="M16.5 31C14 30 13 26 14 23M31.5 31C34 30 35 26 34 23"
          fill="none"
          stroke={WHITE}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <circle cx="19" cy="21" r="1.7" fill={INK} />
        <circle cx="29" cy="21" r="1.7" fill={INK} />
      </>
    ),
  },
};

// A new team's initials, in a colour picked from its name
function monogram(name: string): Badge {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "?";
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return {
    bg: `hsl(${h} 55% 38%)`,
    art: (
      <text
        x="24"
        y="31"
        textAnchor="middle"
        fontSize={initials.length > 1 ? 19 : 23}
        fontWeight="900"
        fontFamily="Arial,sans-serif"
        fill={WHITE}
      >
        {initials}
      </text>
    ),
  };
}

export function TeamLogo({
  name,
  size = 28,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const id = useId();
  const key = historyName(name);
  const badge = BADGES[key] ?? monogram(key);
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={`shrink-0 ${className || "inline-block align-middle"}`}
      aria-hidden
    >
      <clipPath id={id}>
        <circle cx="24" cy="24" r="22" />
      </clipPath>
      <circle cx="24" cy="24" r="23.5" fill={GOLD} />
      <circle cx="24" cy="24" r="22" fill={badge.bg} />
      <g clipPath={`url(#${id})`}>{badge.art}</g>
    </svg>
  );
}
