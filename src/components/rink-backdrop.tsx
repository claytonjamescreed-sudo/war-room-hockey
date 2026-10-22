// The moving background behind every page, from the Chipp rebuild of the site: faint rink
// markings that glow, pucks that glide across with a light trail, slow arena lights and a few
// ice sparkles. Decoration only: it sits behind the page, takes no clicks and is hidden from
// screen readers. Styles (.rink-bg) are in styles.css.
//
// Cost: it is one fixed layer, and every animation moves only transform or opacity, so the
// browser composites it without repainting (scrolling sweeps nothing). With "reduce motion" set
// on the device it stands still.

// Sparkles: fixed positions so the picture is the same on every load
const SPARKLES = Array.from({ length: 16 }, (_, i) => ({
  x: (i * 37 + 11) % 100,
  y: (i * 53 + 7) % 100,
  delay: (i * 1.7) % 9,
  dur: 5 + (i % 5) * 1.3,
  size: 2 + (i % 3),
}));

// Pucks: each glides along its own tilted lane, at its own pace
const PUCKS = [
  { top: 22, angle: -8, dur: 19, delay: -4 },
  { top: 58, angle: 6, dur: 26, delay: -15 },
  { top: 84, angle: -4, dur: 33, delay: -9 },
];

// A rink seen from above, 200 by 85: boards, goal lines, blue lines, the red line, the centre
// circle, four faceoff circles and the creases
function Rink({ transform }: { transform?: string }) {
  return (
    <g transform={transform}>
      <rect className="line" x="1" y="1" width="198" height="83" rx="28" />
      <line className="line goal" x1="11" y1="4" x2="11" y2="81" />
      <line className="line goal" x1="189" y1="4" x2="189" y2="81" />
      <line className="line blue" x1="75" y1="1" x2="75" y2="84" />
      <line className="line blue" x1="125" y1="1" x2="125" y2="84" />
      <line className="line red" x1="100" y1="1" x2="100" y2="84" />
      <circle className="line blue" cx="100" cy="42.5" r="15" />
      <circle className="line red" cx="31" cy="20.5" r="15" />
      <circle className="line red" cx="31" cy="64.5" r="15" />
      <circle className="line red" cx="169" cy="20.5" r="15" />
      <circle className="line red" cx="169" cy="64.5" r="15" />
      <path className="line blue" d="M11 36.5 a6 6 0 0 1 0 12" />
      <path className="line blue" d="M189 36.5 a6 6 0 0 0 0 12" />
    </g>
  );
}

// Wide screens see the rink end to end; tall phone screens see it turned on its side
function Markings() {
  return (
    <>
      <svg className="rink wide" viewBox="0 0 200 85" preserveAspectRatio="xMidYMid slice">
        <Rink />
      </svg>
      <svg className="rink tall" viewBox="0 0 85 200" preserveAspectRatio="xMidYMid slice">
        <Rink transform="translate(85 0) rotate(90)" />
      </svg>
    </>
  );
}

export function RinkBackdrop() {
  return (
    <div className="rink-bg" aria-hidden="true">
      <div className="glow glow-gold" />
      <div className="glow glow-blue" />
      <div className="glow glow-red" />

      <div className="markings">
        <Markings />
      </div>
      {/* The same lines again, thicker, fading in and out: the glow on the ice */}
      <div className="markings shine">
        <Markings />
      </div>

      {PUCKS.map((p, i) => (
        <div
          key={i}
          className="lane"
          style={{ top: `${p.top}%`, transform: `rotate(${p.angle}deg)` }}
        >
          <div
            className="puck"
            style={{ animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s` }}
          />
        </div>
      ))}

      {SPARKLES.map((s, i) => (
        <span
          key={i}
          className="sparkle"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            animationDuration: `${s.dur}s`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
