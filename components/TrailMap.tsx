import type { TrailStop } from '../lib/shared';
export default function TrailMap({
  stops,
  fixture,
}: {
  stops: TrailStop[];
  fixture: boolean;
}) {
  const lons = stops.map((stop) => stop.entity.longitude),
    lats = stops.map((stop) => stop.entity.latitude);
  const minLon = Math.min(...lons),
    maxLon = Math.max(...lons),
    minLat = Math.min(...lats),
    maxLat = Math.max(...lats);
  const X = (lon: number) =>
    65 + ((lon - minLon) / Math.max(0.006, maxLon - minLon)) * 310;
  const Y = (lat: number) =>
    230 - ((lat - minLat) / Math.max(0.006, maxLat - minLat)) * 150;
  const points = stops.map((stop) => ({
    x: X(stop.entity.longitude),
    y: Y(stop.entity.latitude),
  }));
  return (
    <div className="trail-map">
      <svg
        viewBox="0 0 450 290"
        role="img"
        aria-label="Schematic of selected stop positions; straight lines are not navigation routes"
      >
        <rect width="450" height="290" rx="16" fill="#eaece2" />
        <path
          d="M0 206Q79 150 135 197t113-6Q335 130 450 159v131H0z"
          fill="#c9ded8"
        />
        <g stroke="#fffdf5" strokeWidth="9">
          <path d="M0 51h450M0 101h450M0 150h450M47 0v290M106 0v290M169 0v290M238 0v290M308 0v290M380 0v290" />
        </g>
        <g stroke="#e0ddcf" strokeWidth="1">
          <path d="M0 51h450M0 101h450M0 150h450M47 0v290M106 0v290M169 0v290M238 0v290M308 0v290M380 0v290" />
        </g>
        {points.length > 1 && (
          <polyline
            points={points.map((point) => `${point.x},${point.y}`).join(' ')}
            fill="none"
            stroke="#cc765a"
            strokeWidth="3"
            strokeDasharray="5 6"
          />
        )}
        {points.map((point, index) => (
          <g key={index}>
            <circle cx={point.x} cy={point.y} r="21" fill="#fff9ee" />
            <circle cx={point.x} cy={point.y} r="15" fill="#cf795b" />
            <text
              x={point.x}
              y={point.y + 5}
              textAnchor="middle"
              fill="white"
              fontSize="12"
              fontWeight="700"
            >
              {index + 1}
            </text>
          </g>
        ))}
        <rect x="14" y="12" width="168" height="25" rx="5" fill="#fffaf0" />
        <text x="25" y="29" fontSize="10" fill="#536663">
          SCHEMATIC · NOT A STREET MAP
        </text>
      </svg>
      <p>
        {fixture
          ? 'Fictional coordinates for UI testing.'
          : 'Relative positions use the returned Qloo coordinates.'}{' '}
        Background streets and shoreline are decorative; dashed lines do not
        show real routes, distance scales, or travel times.
      </p>
    </div>
  );
}
