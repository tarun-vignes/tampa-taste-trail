import type { Place, Plan, Profile, TrailStop } from './shared';

export function placeRole(place: Place): TrailStop['role'] {
  const tags = place.tags
    .map((tag) => `${tag.id} ${tag.name}`)
    .join(' ')
    .toLowerCase();
  if (/restaurant|cafe\b|coffee\b|dining/.test(tags)) return 'dining';
  if (
    /museum|gallery|cinema|theat(?:er|re)|music.venue|park\b|attraction|art_gallery/.test(
      tags,
    )
  )
    return 'activity';
  return 'place';
}
export function makeStop(
  entity: Place,
  sequence: number,
  signals: Plan['signals'],
  profile: Profile,
  mode: Plan['mode'],
): TrailStop {
  const role = placeRole(entity);
  const signalText = signals.map((signal) => signal.name).join(', ');
  return {
    entity,
    role,
    sequence,
    timeLabel: `Stop ${String(sequence).padStart(2, '0')} · suggested order`,
    why:
      mode === 'fixture'
        ? `Fictional preview linked to the selected fixture signals (${signalText}). This is not Qloo cultural evidence.`
        : `Qloo returned this place for a nearby query using your confirmed signals: ${signalText}. This describes the query inputs, not a proven pairwise explanation or personal guarantee.`,
    signals,
    sourceLabel:
      mode === 'fixture'
        ? 'Fictional fixture — not Qloo'
        : 'Qloo Insights · returned place',
    uncertainties: [
      'Price not verified.',
      'Opening hours and availability not verified.',
      `Capacity for ${profile.partySize} ${profile.partySize === 1 ? 'person' : 'people'} not verified.`,
      role === 'place'
        ? 'Activity/dining category not confirmed by returned tags.'
        : 'Role inferred by the app from returned category tags.',
    ],
  };
}
export function replaceStop(plan: Plan, index: number, id: string): Plan {
  if (!Number.isInteger(index) || index < 0 || index >= plan.stops.length)
    throw new Error('Choose an existing stop.');
  const replacement = plan.alternatives.find((place) => place.id === id);
  if (!replacement)
    throw new Error(
      'Replacement must come from the same validated discovery results.',
    );
  const previous = plan.stops[index].entity;
  const stops = plan.stops.map((stop, i) =>
    i === index
      ? makeStop(replacement, i + 1, plan.signals, plan.profile, plan.mode)
      : stop,
  );
  return {
    ...plan,
    stops,
    alternatives: [
      previous,
      ...plan.alternatives.filter((place) => place.id !== id),
    ],
    warnings: [
      ...new Set([
        ...plan.warnings,
        'A stop was replaced using the same returned Qloo candidate pool (or explicit fixture pool). Recheck geographic order; no travel time is verified.',
      ]),
    ],
  };
}
