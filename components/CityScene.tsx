export default function CityScene() {
  return (
    <svg
      viewBox="0 0 600 410"
      role="img"
      aria-label="Original stylized illustration of a Tampa waterfront, not a geographic map"
      className="city-scene"
    >
      <defs>
        <linearGradient id="sky" x2="0" y2="1">
          <stop stopColor="#f9dfc4" />
          <stop offset="1" stopColor="#fff3df" />
        </linearGradient>
        <linearGradient id="bay" x2="1" y2="1">
          <stop stopColor="#79aead" />
          <stop offset="1" stopColor="#bdd7cb" />
        </linearGradient>
      </defs>
      <rect width="600" height="410" rx="24" fill="url(#sky)" />
      <circle cx="440" cy="125" r="66" fill="#ee9c77" />
      <path d="M0 255Q130 234 246 253t354-5v162H0z" fill="url(#bay)" />
      <path
        d="M52 255V174h37v-49h38v130m18 0V98h63v157m13 0V156h42v-38h31v137m20 0V69h48v186m14 0V141h59v114m15 0V188h65v67"
        fill="#2f5860"
      />
      <path
        d="M158 99V82h36v17M325 70V49h26v21"
        stroke="#2f5860"
        strokeWidth="5"
        fill="none"
      />
      <g stroke="#d1d7ba" strokeWidth="5" opacity=".65">
        <path d="M167 121h28m-28 20h28m-28 20h28m-28 20h28m-28 20h28m-28 20h28M327 91h23m-23 22h23m-23 22h23m-23 22h23m-23 22h23m-23 22h23M388 160h35m-35 20h35m-35 20h35m-35 20h35" />
      </g>
      <path d="M0 296Q171 291 264 332T600 361v49H0z" fill="#f0d1a8" />
      <path
        d="M0 313Q167 302 271 349T600 380"
        fill="none"
        stroke="#fff4df"
        strokeWidth="14"
      />
      <g stroke="#547776" strokeWidth="2" opacity=".55">
        <path d="M80 275h70m30 9h99m88-10h108M31 292h40m265 14h70m55-12h78" />
      </g>
      <g fill="none" stroke="#274c48" strokeWidth="8" strokeLinecap="round">
        <path d="M485 360q17-69 13-112M500 250q-49-53-78-14m77 13q9-58 43-58m-43 58q48-21 65 10m-65-10q-25-52-16-74" />
      </g>
      <g fill="#365e4b">
        <path d="M499 250q-37-30-77-14 13-46 77 14m0 0q15-48 43-58 12 37-43 58m0 0q43-3 65 9-4-39-65-9m0 0q-14-53-16-74-27 23 16 74" />
      </g>
      <path d="M55 356l125-27m-98 48l126-27" stroke="#a87b56" strokeWidth="4" />
      <path d="M75 350v39m41-48v38m41-47v39" stroke="#a87b56" strokeWidth="5" />
      <g fill="#24434d">
        <path d="M79 58q13-10 26 0-13-4-26 0m30-18q12-9 24 0-12-4-24 0" />
      </g>
      <circle cx="105" cy="184" r="18" fill="#f5eee3" />
      <text x="105" y="190" textAnchor="middle" fill="#d37956" fontSize="18">
        ♪
      </text>
      <circle cx="273" cy="150" r="18" fill="#f5eee3" />
      <text x="273" y="156" textAnchor="middle" fill="#737da6" fontSize="17">
        ✦
      </text>
      <circle cx="404" cy="225" r="18" fill="#f5eee3" />
      <text x="404" y="231" textAnchor="middle" fill="#416f62" fontSize="17">
        ✳
      </text>
    </svg>
  );
}
