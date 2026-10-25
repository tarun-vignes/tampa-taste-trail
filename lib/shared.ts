import { z } from 'zod';

export const areas = [
  'Tampa',
  'Downtown',
  'Ybor City',
  'Seminole Heights',
  'Hyde Park',
] as const;
export const categories = ['music', 'film', 'dining', 'activity'] as const;
export const interestSchema = z
  .object({
    term: z.string().trim().min(2).max(80),
    category: z.enum(categories),
    lookup: z.enum(['entity', 'tag']),
  })
  .strict();
export const profileSchema = z
  .object({
    interests: z.array(interestSchema).min(1).max(4),
    budgetCents: z.number().int().min(0).max(1000000).nullable(),
    priceLevel: z.number().int().min(1).max(4).nullable(),
    partySize: z.number().int().min(1).max(12),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .refine(
        (value) =>
          value === null ||
          (!Number.isNaN(Date.parse(value)) &&
            new Date(value).toISOString().slice(0, 10) === value),
        'Use a valid calendar date.',
      ),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    area: z.enum(areas),
    pace: z.enum(['relaxed', 'balanced']),
    focus: z.enum(['mixed', 'dining', 'activity']),
    notes: z.array(z.string().trim().min(1).max(160)).max(6),
  })
  .strict();
export type Profile = z.infer<typeof profileSchema>;
export type Interest = z.infer<typeof interestSchema>;
export const modeSchema = z.enum(['live', 'fixture']);
export type Mode = z.infer<typeof modeSchema>;
export const parseInputSchema = z
  .object({
    prompt: z.string().trim().min(10).max(1500),
    useRules: z.boolean().default(false),
  })
  .strict();
export type ParsedProfile = {
  profile: Profile;
  parser: 'gemini' | 'rules';
  model: string | null;
  notice: string;
};
export const resolutionInputSchema = z
  .object({ profile: profileSchema, mode: modeSchema })
  .strict();
export const planInputSchema = resolutionInputSchema
  .extend({
    selected: z
      .array(
        z
          .object({
            interestIndex: z.number().int().min(0).max(3),
            id: z.string().min(1).max(250),
          })
          .strict(),
      )
      .min(1)
      .max(4),
  })
  .strict();
export type PlanInput = z.infer<typeof planInputSchema>;
export type Candidate = {
  id: string;
  name: string;
  kind: 'entity' | 'tag';
  category: string;
};
export type Resolution = {
  interest: Interest;
  interestIndex: number;
  candidates: Candidate[];
  exactId: string | null;
};
export type ResolvedTaste = {
  items: Resolution[];
  mode: Mode;
  sourceLabel: string;
  warnings: string[];
};
export type Place = {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  tags: { id: string; name: string }[];
  website: string | null;
  priceLevel: number | null;
};
export type TraceStep = {
  action: 'resolve' | 'validate' | 'recommend' | 'assemble';
  detail: string;
  source: 'Qloo' | 'App' | 'Fictional fixture';
};
export type TrailStop = {
  entity: Place;
  role: 'dining' | 'activity' | 'place';
  sequence: number;
  timeLabel: string;
  why: string;
  signals: Candidate[];
  sourceLabel: string;
  uncertainties: string[];
};
export type Plan = {
  mode: Mode;
  profile: Profile;
  signals: Candidate[];
  stops: TrailStop[];
  alternatives: Place[];
  warnings: string[];
  trace: TraceStep[];
  retrievedAt: string;
  budgetStatus: 'not_verified';
  sourceLabel: string;
  discardedCount: number;
};
export type PublicConfig = {
  qlooAvailable: boolean;
  aiAvailable: boolean;
  aiModel: string | null;
  fixtureAvailable: boolean;
  limits: { interests: number; maxStops: number };
};
export const dollars = (cents: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(cents / 100);
