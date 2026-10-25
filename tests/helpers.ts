import type { Place, Profile } from '../lib/shared';
export const profile: Profile = {
  interests: [
    { term: 'Afrobeats', category: 'music', lookup: 'tag' },
    { term: 'Science Fiction', category: 'film', lookup: 'tag' },
    { term: 'Spicy', category: 'dining', lookup: 'tag' },
  ],
  budgetCents: 10000,
  priceLevel: null,
  partySize: 2,
  date: '2026-10-24',
  time: '18:00',
  area: 'Tampa',
  pace: 'relaxed',
  focus: 'mixed',
  notes: [],
};
export const rawPlace = (
  id = '10000000-0000-0000-0000-000000000001',
  lat = 27.95,
  lon = -82.457,
) => ({
  entity_id: id,
  name: 'Mocked place from provider response',
  type: 'urn:entity',
  subtype: 'urn:entity:place',
  location: { lat, lon },
  properties: {
    description: 'Mocked provider description',
    address: 'Mock test address',
    websites: ['javascript:alert(1)', 'https://example.com/'],
    price_level: 2,
  },
  tags: [{ id: 'urn:tag:genre:restaurant:italian', name: 'Italian' }],
});
export const place: Place = {
  id: '10000000-0000-0000-0000-000000000001',
  name: 'Mocked provider place',
  description: null,
  address: null,
  latitude: 27.95,
  longitude: -82.457,
  tags: [{ id: 'urn:tag:genre:restaurant:italian', name: 'Italian' }],
  website: null,
  priceLevel: 2,
};
