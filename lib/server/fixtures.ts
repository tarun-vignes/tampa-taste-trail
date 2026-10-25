import type { Candidate, Interest, Place, Profile } from '../shared';
import type { DiscoveryPort } from './qloo';
import { inSearchArea } from './geography';

// Original, fictional UI fixtures. These are NOT Qloo records or real Tampa venues.
const labels: Record<string, { name: string; slug: string }> = {
  afrobeats: { name: 'Afrobeats', slug: 'afrobeats' },
  jazz: { name: 'Jazz', slug: 'jazz' },
  indie: { name: 'Indie', slug: 'indie' },
  'science fiction': { name: 'Science Fiction', slug: 'science-fiction' },
  comedy: { name: 'Comedy', slug: 'comedy' },
  spicy: { name: 'Spicy', slug: 'spicy' },
  coffee: { name: 'Coffee', slug: 'coffee' },
  art: { name: 'Art', slug: 'art' },
};
export const fictionalPlaces: Place[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Palmetto Pepper Table',
    description:
      'Fictional preview dining stop. Not a real business or a Qloo recommendation.',
    address: null,
    latitude: 27.9504,
    longitude: -82.4568,
    tags: [
      {
        id: 'urn:tag:genre:restaurant:fixture',
        name: 'Restaurant (fictional)',
      },
    ],
    website: null,
    priceLevel: null,
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'Bayline Listening Room',
    description:
      'Fictional preview cultural stop. No performance, hours, or admission price is claimed.',
    address: null,
    latitude: 27.9536,
    longitude: -82.4525,
    tags: [
      {
        id: 'urn:tag:category:place:music_venue',
        name: 'Music venue (fictional)',
      },
    ],
    website: null,
    priceLevel: null,
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    name: 'Lantern Film Corner',
    description:
      'Fictional preview cinema concept. This does not represent a real screening or schedule.',
    address: null,
    latitude: 27.9474,
    longitude: -82.4601,
    tags: [{ id: 'urn:tag:category:place:cinema', name: 'Cinema (fictional)' }],
    website: null,
    priceLevel: null,
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    name: 'Tide & Canvas Studio',
    description:
      'Fictional preview art stop. No real opening hours, booking or cost data.',
    address: null,
    latitude: 27.9512,
    longitude: -82.4621,
    tags: [
      {
        id: 'urn:tag:category:place:art_gallery',
        name: 'Art gallery (fictional)',
      },
    ],
    website: null,
    priceLevel: null,
  },
];
export class FixtureDiscovery implements DiscoveryPort {
  async resolve(interest: Interest): Promise<Candidate[]> {
    const item = labels[interest.term.toLowerCase().trim()];
    return item
      ? [
          {
            id: `urn:tag:fixture:${item.slug}`,
            name: item.name,
            kind: 'tag',
            category: `Fictional ${interest.category} tag`,
          },
        ]
      : [];
  }
  async discover(profile: Profile, signals: Candidate[]) {
    const places = fictionalPlaces.filter((place) =>
      inSearchArea(place, profile.area),
    );
    // Preview-only deterministic ordering; not an approximation of Qloo affinity.
    const film = signals.some(
      (s) => s.id.includes('science-fiction') || s.id.includes('comedy'),
    );
    const sorted = [...places].sort((a, b) =>
      film ? Number(b.id.endsWith('003')) - Number(a.id.endsWith('003')) : 0,
    );
    return {
      places: sorted,
      discarded: fictionalPlaces.length - places.length,
    };
  }
}
