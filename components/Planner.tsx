'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  areas,
  categories,
  dollars,
  profileSchema,
  type Interest,
  type Mode,
  type ParsedProfile,
  type Plan,
  type Profile,
  type PublicConfig,
  type ResolvedTaste,
} from '../lib/shared';
import { requestJson } from '../lib/client';
import { replaceStop } from '../lib/trail';
import CityScene from './CityScene';
import TrailMap from './TrailMap';

const examples = [
  {
    name: 'A relaxed evening',
    prompt:
      'I like Afrobeats, sci-fi movies, and spicy food. Plan a relaxed Saturday evening in Tampa for two people, under $100.',
  },
  {
    name: 'Jazz & a little art',
    prompt:
      'I love jazz, coffee, and art galleries. Plan a relaxed afternoon in Downtown Tampa for two, with a total budget of $80.',
  },
  {
    name: 'A different neighborhood',
    prompt:
      'I like indie music and comedy. A balanced evening in Ybor City for two people, under $120.',
  },
];
const glyph: Record<string, string> = {
  music: '♫',
  film: '◈',
  dining: '✳',
  activity: '✦',
};
const errorText = (error: unknown) =>
  error instanceof Error
    ? error.message
    : 'Planning could not be completed. Please retry.';
type Busy = 'parse' | 'resolve' | 'plan' | null;

export default function Planner() {
  const [config, setConfig] = useState<PublicConfig | null>(null),
    [configError, setConfigError] = useState('');
  const [prompt, setPrompt] = useState(examples[0].prompt),
    [parsed, setParsed] = useState<ParsedProfile | null>(null),
    [profile, setProfile] = useState<Profile | null>(null);
  const [resolved, setResolved] = useState<ResolvedTaste | null>(null),
    [selected, setSelected] = useState<Record<number, string>>({}),
    [mode, setMode] = useState<Mode>('live');
  const [plan, setPlan] = useState<Plan | null>(null),
    [busy, setBusy] = useState<Busy>(null),
    [error, setError] = useState<{ stage: Busy; message: string } | null>(null),
    [copied, setCopied] = useState(false);
  const profileRef = useRef<HTMLElement>(null),
    planRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    requestJson<PublicConfig>('/api/status', undefined, controller.signal)
      .then(setConfig)
      .catch((error) => {
        if (!controller.signal.aborted) setConfigError(errorText(error));
      });
    return () => controller.abort();
  }, []);
  function scrollTo(target: 'profile' | 'plan') {
    setTimeout(() => {
      (target === 'profile' ? profileRef : planRef).current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 50);
  }
  async function extract(useRules = false) {
    setBusy('parse');
    setError(null);
    setResolved(null);
    setPlan(null);
    setCopied(false);
    try {
      const result = await requestJson<ParsedProfile>('/api/parse', {
        prompt,
        useRules,
      });
      setParsed(result);
      setProfile(result.profile);
      setSelected({});
      scrollTo('profile');
    } catch (error) {
      setError({ stage: 'parse', message: errorText(error) });
    } finally {
      setBusy(null);
    }
  }
  function updateProfile(patch: Partial<Profile>) {
    if (!profile) return;
    setProfile({ ...profile, ...patch });
    setPlan(null);
    setCopied(false);
    if (patch.interests) {
      setResolved(null);
      setSelected({});
    }
    setError(null);
  }
  function editInterest(index: number, patch: Partial<Interest>) {
    if (profile)
      updateProfile({
        interests: profile.interests.map((interest, i) =>
          i === index ? { ...interest, ...patch } : interest,
        ),
      });
  }
  async function resolveTaste(requestMode: Mode) {
    if (!profile) return;
    setBusy('resolve');
    setError(null);
    setResolved(null);
    setPlan(null);
    setSelected({});
    setMode(requestMode);
    try {
      profileSchema.parse(profile);
      const result = await requestJson<ResolvedTaste>('/api/resolve', {
        profile,
        mode: requestMode,
      });
      setResolved(result);
      const defaults: Record<number, string> = {};
      for (const item of result.items)
        if (item.exactId) defaults[item.interestIndex] = item.exactId;
      setSelected(defaults);
    } catch (error) {
      setError({
        stage: 'resolve',
        message:
          error instanceof Error && error.name === 'ZodError'
            ? 'Please check the taste terms, date, time, budget and party size.'
            : errorText(error),
      });
    } finally {
      setBusy(null);
    }
  }
  async function buildTrail() {
    if (!profile) return;
    setBusy('plan');
    setError(null);
    setPlan(null);
    try {
      const choices = Object.entries(selected)
        .filter(([, id]) => !!id)
        .map(([index, id]) => ({ interestIndex: Number(index), id }));
      const result = await requestJson<Plan>('/api/plan', {
        profile,
        mode,
        selected: choices,
      });
      setPlan(result);
      setCopied(false);
      scrollTo('plan');
    } catch (error) {
      setError({ stage: 'plan', message: errorText(error) });
    } finally {
      setBusy(null);
    }
  }
  function changeStop(index: number, id: string) {
    if (!plan || !id) return;
    try {
      setPlan(replaceStop(plan, index, id));
      setCopied(false);
    } catch (error) {
      setError({ stage: 'plan', message: errorText(error) });
    }
  }
  async function copyTrail() {
    if (!plan) return;
    const text = [
      `Tampa Taste Trail — ${plan.sourceLabel}`,
      `${plan.profile.area} · ${plan.profile.date || 'Date not selected'} · preferred start ${plan.profile.time} · ${plan.profile.partySize} guests`,
      `Group budget: ${plan.profile.budgetCents === null ? 'Not specified' : dollars(plan.profile.budgetCents)}. Prices NOT verified.`,
      ...plan.stops.map(
        (stop) =>
          `${stop.sequence}. ${stop.entity.name}\n${stop.why}\n${stop.sourceLabel}\n${stop.uncertainties.join(' ')}`,
      ),
      ...plan.warnings,
    ].join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setError({
        stage: 'plan',
        message:
          'Clipboard access is unavailable. You can select and copy the visible itinerary text.',
      });
    }
  }
  const selectedCount = Object.values(selected).filter(Boolean).length;
  return (
    <>
      <div className="top-strip">
        A local city. A whole world of taste.{' '}
        <span>Thoughtful plans. Clear sources.</span>
      </div>
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Tampa Taste Trail home">
          <span className="brand-icon">⌁</span>
          <span>
            Tampa <b>Taste Trail</b>
            <small>CULTURE, CONNECTED.</small>
          </span>
        </Link>
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#planner">
            Plan your outing <span>↗</span>
          </a>
        </nav>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span /> TAMPA, THROUGH YOUR LENS
            </div>
            <h1>
              Your kind of taste.
              <br />
              <em>
                A different kind
                <br />
                of Tampa.
              </em>
            </h1>
            <p>
              From the music on repeat to the films you love, turn your cultural
              taste into a more personal outing.
            </p>
            <a className="primary hero-cta" href="#planner">
              Find your trail <span>↗</span>
            </a>
            <div className="taste-ribbon">
              <span>♫ Music</span>
              <i>↔</i>
              <span>◈ Film</span>
              <i>↔</i>
              <span>✳ Food</span>
              <i>↔</i>
              <span>✦ More</span>
            </div>
          </div>
          <div className="hero-art">
            <CityScene />
            <div className="art-caption">
              <span className="small-dot" />
              <span>One city. Connected by what you love.</span>
              <small>Original illustration</small>
            </div>
            <div className="floating-label">
              <span>✳</span>
              <div>
                Not just nearby.
                <br />
                <b>Closer to your taste.</b>
              </div>
            </div>
          </div>
        </section>
        <div className="section-rule">
          <span>A GOOD PLAN STARTS WITH YOU</span>
          <span>01 / TASTE → 02 / QLOO → 03 / YOUR TRAIL</span>
        </div>
        <section className="intake-section" id="planner">
          <div className="intake-intro">
            <span className="eyebrow">01 / THE STARTING POINT</span>
            <h2>
              What’s your
              <br />
              <em>kind of evening?</em>
            </h2>
            <p>
              Tell us what moves you. We’ll extract a taste profile for you to
              check, then ask Qloo to connect the dots.
            </p>
            <div className="service-state">
              <span
                className={
                  config?.qlooAvailable ? 'connection-dot on' : 'connection-dot'
                }
              />
              <div>
                <strong>
                  {config?.qlooAvailable
                    ? 'Qloo key configured'
                    : 'Qloo key not configured'}
                </strong>
                <p>
                  {config?.qlooAvailable
                    ? 'Cultural discovery is available to try. Key validity is checked on each API request.'
                    : 'Real cultural matches need a server-side Qloo key. Fictional preview is a separate, explicit option.'}
                </p>
              </div>
            </div>
            <div className="service-state">
              <span
                className={
                  config?.aiAvailable ? 'connection-dot on' : 'connection-dot'
                }
              />
              <div>
                <strong>
                  {config?.aiAvailable
                    ? 'Gemini extraction ready'
                    : 'Rule-based extraction available'}
                </strong>
                <p>
                  The parser reads your request. Qloo supplies cultural
                  discovery. Neither confirms bookings or availability.
                </p>
              </div>
            </div>
          </div>
          <div className="request-card">
            <div className="card-heading">
              <span className="eyebrow">YOUR OUTING BRIEF</span>
              <span className="pill">NO ACCOUNT NEEDED</span>
            </div>
            <form
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                void extract();
              }}
            >
              <label htmlFor="taste-request">
                A few things you love, and what you have in mind
              </label>
              <textarea
                id="taste-request"
                rows={5}
                maxLength={1500}
                minLength={10}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                required
                disabled={!!busy}
              />
              <div className="example-prompts">
                <span>A little inspiration</span>
                {examples.map((example) => (
                  <button
                    type="button"
                    key={example.name}
                    disabled={!!busy}
                    onClick={() => setPrompt(example.prompt)}
                  >
                    {example.name} ↗
                  </button>
                ))}
              </div>
              <button
                className="primary full"
                disabled={!!busy || !config}
                type="submit"
              >
                {busy === 'parse' ? (
                  <>
                    <span className="spinner" />
                    Reading your taste…
                  </>
                ) : (
                  <>
                    Shape my taste profile <span>↗</span>
                  </>
                )}
              </button>
              <p className="privacy-note">
                Only your taste request goes to the parser. Keep personal or
                sensitive information out.
              </p>
            </form>
            {configError && (
              <div className="notice error" role="alert">
                Could not load service status. {configError} Refresh the page to
                reconnect.
              </div>
            )}
            {!config && !configError && (
              <p role="status" className="small">
                Checking server configuration…
              </p>
            )}
            {error?.stage === 'parse' && (
              <div className="notice error" role="alert">
                {error.message}
                <button disabled={!!busy} onClick={() => void extract(true)}>
                  Use rule-based extraction
                </button>
              </div>
            )}
          </div>
        </section>

        {profile && (
          <section
            className="profile-section"
            ref={profileRef}
            aria-label="Taste profile"
          >
            <div className="section-heading">
              <div>
                <span className="eyebrow">02 / MAKE IT YOURS</span>
                <h2>
                  Your taste, <em>in focus.</em>
                </h2>
              </div>
              <span className="pill">
                {parsed?.parser === 'gemini'
                  ? `AI extraction · ${parsed.model}`
                  : 'Rule-based extraction · not generative AI'}
              </span>
            </div>
            <p className="section-description">
              {parsed?.notice} Edit or remove anything that misses the mark. No
              venue has been recommended yet.
            </p>
            <fieldset disabled={!!busy} className="profile-fieldset">
              <legend className="sr-only">Edit extracted preferences</legend>
              <div className="interest-list">
                {profile.interests.map((interest, index) => (
                  <div
                    className={`interest-card ${interest.category}`}
                    key={index}
                  >
                    <span className="interest-icon">
                      {glyph[interest.category]}
                    </span>
                    <div className="interest-inputs">
                      <label htmlFor={`interest-${index}`}>
                        Taste {index + 1}
                        <input
                          id={`interest-${index}`}
                          value={interest.term}
                          maxLength={80}
                          minLength={2}
                          onChange={(event) =>
                            editInterest(index, { term: event.target.value })
                          }
                        />
                      </label>
                      <div className="interest-selects">
                        <label>
                          Category
                          <select
                            aria-label={`Category for taste ${index + 1}`}
                            value={interest.category}
                            onChange={(event) =>
                              editInterest(index, {
                                category: event.target
                                  .value as Interest['category'],
                              })
                            }
                          >
                            {categories.map((category) => (
                              <option key={category}>{category}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Look up as
                          <select
                            aria-label={`Lookup for taste ${index + 1}`}
                            value={interest.lookup}
                            onChange={(event) =>
                              editInterest(index, {
                                lookup: event.target
                                  .value as Interest['lookup'],
                              })
                            }
                          >
                            <option value="tag">Genre / concept</option>
                            <option value="entity">Named artist / film</option>
                          </select>
                        </label>
                      </div>
                    </div>
                    <button
                      className="icon-button"
                      aria-label={`Remove taste ${index + 1}`}
                      disabled={profile.interests.length === 1 || !!busy}
                      onClick={() =>
                        updateProfile({
                          interests: profile.interests.filter(
                            (_, i) => i !== index,
                          ),
                        })
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              {profile.interests.length < 4 && (
                <button
                  className="add-taste"
                  onClick={() =>
                    updateProfile({
                      interests: [
                        ...profile.interests,
                        { term: '', category: 'music', lookup: 'tag' },
                      ],
                    })
                  }
                >
                  ＋ Add a taste
                </button>
              )}
              <div className="constraints-grid">
                <label>
                  Search area
                  <select
                    value={profile.area}
                    onChange={(event) =>
                      updateProfile({
                        area: event.target.value as Profile['area'],
                      })
                    }
                  >
                    {areas.map((area) => (
                      <option key={area}>{area}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Total group budget · USD
                  <input
                    type="number"
                    min="0"
                    max="10000"
                    step="0.01"
                    value={
                      profile.budgetCents === null
                        ? ''
                        : profile.budgetCents / 100
                    }
                    placeholder="Not specified"
                    onChange={(event) =>
                      updateProfile({
                        budgetCents:
                          event.target.value === ''
                            ? null
                            : Math.round(Number(event.target.value) * 100),
                      })
                    }
                  />
                </label>
                <label>
                  Party size
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={profile.partySize}
                    onChange={(event) =>
                      updateProfile({ partySize: Number(event.target.value) })
                    }
                  />
                </label>
                <label>
                  Preferred date
                  <input
                    type="date"
                    value={profile.date || ''}
                    onChange={(event) =>
                      updateProfile({ date: event.target.value || null })
                    }
                  />
                </label>
                <label>
                  Preferred start
                  <input
                    type="time"
                    value={profile.time}
                    onChange={(event) =>
                      updateProfile({ time: event.target.value })
                    }
                  />
                </label>
                <label>
                  Pace
                  <select
                    value={profile.pace}
                    onChange={(event) =>
                      updateProfile({
                        pace: event.target.value as Profile['pace'],
                      })
                    }
                  >
                    <option value="relaxed">Relaxed · up to 2 stops</option>
                    <option value="balanced">Balanced · up to 3 stops</option>
                  </select>
                </label>
                <label>
                  Outing focus
                  <select
                    value={profile.focus}
                    onChange={(event) =>
                      updateProfile({
                        focus: event.target.value as Profile['focus'],
                      })
                    }
                  >
                    <option value="mixed">A mix of places</option>
                    <option value="dining">Dining only</option>
                    <option value="activity">Activities only</option>
                  </select>
                </label>
                <label>
                  Optional restaurant tier
                  <select
                    value={profile.priceLevel ?? ''}
                    onChange={(event) =>
                      updateProfile({
                        priceLevel:
                          event.target.value === ''
                            ? null
                            : Number(event.target.value),
                      })
                    }
                  >
                    <option value="">Any tier · not a quote</option>
                    {[1, 2, 3, 4].map((tier) => (
                      <option value={tier} key={tier}>
                        Up to {'$'.repeat(tier)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </fieldset>
            {profile.notes.length > 0 && (
              <details className="profile-notes">
                <summary>Other extracted notes · not verified</summary>
                <ul>
                  {profile.notes.map((note, index) => (
                    <li key={index}>
                      {note}{' '}
                      <button
                        disabled={!!busy}
                        aria-label={`Remove note ${index + 1}`}
                        onClick={() =>
                          updateProfile({
                            notes: profile.notes.filter((_, i) => i !== index),
                          })
                        }
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <div className="profile-foot">
              <p>
                Budget, date, time and party size are planning preferences. No
                current prices, opening hours, capacity, or event schedules are
                verified.
              </p>
              <div className="profile-actions">
                <button
                  className="primary"
                  disabled={!!busy}
                  onClick={() => void resolveTaste('live')}
                >
                  {busy === 'resolve' && mode === 'live'
                    ? 'Looking up Qloo signals…'
                    : 'Find my Qloo signals'}{' '}
                  <span>↗</span>
                </button>
                {config?.fixtureAvailable && (
                  <button
                    className="secondary"
                    disabled={!!busy}
                    onClick={() => void resolveTaste('fixture')}
                  >
                    {busy === 'resolve' && mode === 'fixture'
                      ? 'Opening fictional fixtures…'
                      : 'Explore fictional preview'}
                  </button>
                )}
              </div>
            </div>
            {error?.stage === 'resolve' && (
              <div className="notice error" role="alert">
                {error.message}
              </div>
            )}
            {resolved && (
              <div className="resolution-panel">
                <div className="card-heading">
                  <h3>Confirm the cultural connections.</h3>
                  <span
                    className={
                      mode === 'fixture' ? 'pill fixture' : 'pill source-qloo'
                    }
                  >
                    {resolved.sourceLabel}
                  </span>
                </div>
                <p className="small">
                  A search match is a candidate, not proof it means what you
                  intended. Exact-name matches are preselected; review them.
                  Leave a term unused or choose a clearer match.
                </p>
                <div className="signal-grid">
                  {resolved.items.map((item) => (
                    <label className="signal-choice" key={item.interestIndex}>
                      <span>
                        {glyph[item.interest.category]} {item.interest.term}
                      </span>
                      <select
                        aria-label={`Confirm ${item.interest.term}`}
                        disabled={!!busy || !item.candidates.length}
                        value={selected[item.interestIndex] || ''}
                        onChange={(event) => {
                          setSelected({
                            ...selected,
                            [item.interestIndex]: event.target.value,
                          });
                          setPlan(null);
                        }}
                      >
                        <option value="">
                          {item.candidates.length
                            ? 'Choose / leave unused'
                            : 'No match — edit this taste'}
                        </option>
                        {item.candidates.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.name} ·{' '}
                            {candidate.kind === 'entity'
                              ? candidate.category.replace('urn:entity:', '')
                              : 'tag'}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                {resolved.warnings.map((warning) => (
                  <p className="warning-line" key={warning}>
                    {warning}
                  </p>
                ))}
                <div className="resolve-bottom">
                  <span>
                    {selectedCount} confirmed{' '}
                    {selectedCount === 1 ? 'signal' : 'signals'} ·{' '}
                    {mode === 'fixture'
                      ? 'no Qloo data used'
                      : 'IDs revalidated before planning'}
                  </span>
                  <button
                    className="primary"
                    disabled={!!busy || selectedCount === 0}
                    onClick={() => void buildTrail()}
                  >
                    {busy === 'plan' ? (
                      <>
                        <span className="spinner" />
                        Discovering your trail…
                      </>
                    ) : (
                      <>
                        Build my{' '}
                        {mode === 'fixture'
                          ? 'fictional preview'
                          : 'taste trail'}{' '}
                        <span>↗</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
        {busy && (
          <div className="planning-progress" role="status">
            <span className="spinner" />
            <div>
              <strong>
                {busy === 'parse'
                  ? 'Reading preferences'
                  : busy === 'resolve'
                    ? 'Resolving cultural signals'
                    : 'Discovering, validating, and ordering places'}
              </strong>
              <p>
                {busy === 'parse'
                  ? 'You can correct the interpretation before searching.'
                  : 'Lookup and discovery can take a moment. No substitute results are shown if Qloo fails.'}
              </p>
            </div>
          </div>
        )}
        {error?.stage === 'plan' && (
          <div className="notice error" role="alert">
            {error.message}
          </div>
        )}

        {plan && (
          <section
            className="trail-section"
            ref={planRef}
            aria-label="Your outing"
          >
            <div className="section-heading">
              <div>
                <span className="eyebrow">03 / YOUR TASTE, TAKING SHAPE</span>
                <h2>
                  A little trail.
                  <br />
                  <em>A lot more you.</em>
                </h2>
              </div>
              <button
                className="secondary"
                disabled={!plan.stops.length}
                onClick={() => void copyTrail()}
              >
                {copied
                  ? 'Copied with source notes ✓'
                  : 'Copy trail + source notes ↗'}
              </button>
            </div>
            <div
              className={
                plan.mode === 'fixture'
                  ? 'notice fixture-banner'
                  : 'notice live-banner'
              }
            >
              <strong>
                {plan.mode === 'fixture'
                  ? 'Fictional preview — not real Qloo recommendations.'
                  : 'Grounded in Qloo discovery. Ordered by the app.'}
              </strong>
              <p>
                {plan.mode === 'fixture'
                  ? 'These names and coordinates are original UI fixtures. They are not real Tampa venues, events, or taste-graph results.'
                  : 'Every displayed stop came from the returned Qloo place results and passed geographic validation. The plan does not confirm bookings, events, hours or prices.'}
              </p>
            </div>
            <div className="plan-context">
              <span>◎ {plan.profile.area}</span>
              <span>
                ♧ {plan.profile.partySize}{' '}
                {plan.profile.partySize === 1 ? 'guest' : 'guests'}
              </span>
              <span>
                ◷ {plan.profile.date || 'Date flexible'} · {plan.profile.time}{' '}
                preferred start
              </span>
              <span>
                {plan.profile.budgetCents === null
                  ? 'No budget specified'
                  : `${dollars(plan.profile.budgetCents)} group budget`}{' '}
                · <b>price not verified</b>
              </span>
            </div>
            {!plan.stops.length ? (
              <div className="empty-state" role="status">
                <span>⌁</span>
                <h3>No nearby trail to confirm yet.</h3>
                <p>
                  No suitable, geographically validated results remain. Try a
                  broader area, another taste term, or a mixed outing focus. No
                  venue or event was invented to fill a gap.
                </p>
                <a href="#planner">Revise preferences ↑</a>
              </div>
            ) : (
              <div className="trail-layout">
                <div className="timeline">
                  {plan.stops.map((stop, index) => (
                    <article
                      className={`stop-card ${stop.role}`}
                      key={stop.entity.id}
                    >
                      <div className="stop-number">
                        {String(stop.sequence).padStart(2, '0')}
                      </div>
                      <div className="stop-content">
                        <div className="card-heading">
                          <span className="eyebrow">
                            {stop.role === 'dining'
                              ? 'A PLACE TO EAT'
                              : stop.role === 'activity'
                                ? 'A CULTURAL STOP'
                                : 'A PLACE TO CONSIDER'}
                          </span>
                          <span
                            className={
                              plan.mode === 'fixture'
                                ? 'pill fixture'
                                : 'pill source-qloo'
                            }
                          >
                            {plan.mode === 'fixture'
                              ? 'FICTIONAL'
                              : 'QLOO RESULT'}
                          </span>
                        </div>
                        <h3>{stop.entity.name}</h3>
                        <p className="stop-description">
                          {stop.entity.description ||
                            'Qloo did not supply a description. No description has been invented.'}
                        </p>
                        {stop.entity.address && (
                          <p className="place-address">
                            ◎ {stop.entity.address} <small>· Qloo data</small>
                          </p>
                        )}
                        <div className="tag-row">
                          {stop.entity.tags.slice(0, 4).map((tag) => (
                            <span key={tag.id}>{tag.name}</span>
                          ))}
                        </div>
                        <div className="why-fit">
                          <h4>Why it’s on your trail</h4>
                          <p>{stop.why}</p>
                          <div className="source-chips">
                            {stop.signals.map((signal) => (
                              <span key={signal.id}>{signal.name}</span>
                            ))}
                          </div>
                        </div>
                        <div className="unknowns">
                          <span>CHECK BEFORE YOU GO</span>
                          <p>{stop.uncertainties.join(' ')}</p>
                          {stop.entity.priceLevel !== null && (
                            <p>
                              Returned restaurant tier:{' '}
                              {'$'.repeat(stop.entity.priceLevel)}. This is not
                              a current price.
                            </p>
                          )}
                        </div>
                        <div className="stop-links">
                          {plan.mode === 'live' && (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${stop.entity.latitude},${stop.entity.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Check location ↗
                            </a>
                          )}
                          {plan.mode === 'live' && stop.entity.website && (
                            <a
                              href={stop.entity.website}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Qloo-listed website ↗
                            </a>
                          )}
                        </div>
                        {plan.alternatives.length > 0 && (
                          <label className="swap-label">
                            Change this stop
                            <select
                              aria-label={`Replace stop ${index + 1}`}
                              value=""
                              onChange={(event) =>
                                changeStop(index, event.target.value)
                              }
                            >
                              <option value="">
                                Pick another returned option
                              </option>
                              {plan.alternatives.map((place) => (
                                <option key={place.id} value={place.id}>
                                  {place.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                        <p className="source-detail">
                          {stop.sourceLabel} · ID {stop.entity.id}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
                <aside className="trail-sidebar">
                  <div className="sidebar-card">
                    <span className="eyebrow">THE SHAPE OF YOUR OUTING</span>
                    <h3>A suggested sequence.</h3>
                    <TrailMap
                      stops={plan.stops}
                      fixture={plan.mode === 'fixture'}
                    />
                    <ol>
                      {plan.stops.map((stop) => (
                        <li key={stop.entity.id}>{stop.entity.name}</li>
                      ))}
                    </ol>
                    <p className="small">
                      Search circles are app-defined approximations, not
                      official neighborhood boundaries. Ordering uses category
                      tags and straight-line proximity; no travel time is
                      estimated.
                    </p>
                  </div>
                  <div className="sidebar-card budget-card">
                    <span className="eyebrow">YOUR BUDGET, HONESTLY</span>
                    <strong>
                      {plan.profile.budgetCents === null
                        ? 'Not specified'
                        : dollars(plan.profile.budgetCents)}
                    </strong>
                    <p>
                      Total group target for {plan.profile.partySize}.{' '}
                      <b>Price not verified.</b> Menu prices, tickets,
                      transport, tax and fees are not supplied, so this plan is
                      not certified to fit your budget.
                    </p>
                    <a href="#planner">Change budget or area ↑</a>
                  </div>
                </aside>
              </div>
            )}
            <details className="agent-trace">
              <summary>
                <span>Inside the agent workflow</span>
                <span>Source-by-source, step-by-step ＋</span>
              </summary>
              <ol>
                {plan.trace.map((step, index) => (
                  <li key={index}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <div>
                      <strong>
                        {step.action} <small>{step.source}</small>
                      </strong>
                      <p>{step.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="small">
                Response generated{' '}
                {new Date(plan.retrievedAt).toLocaleString('en-US', {
                  timeZone: 'America/New_York',
                })}{' '}
                Eastern. Lookup/discovery responses may be cached in memory for
                up to five minutes; this is not a live availability feed.
              </p>
            </details>
            <details className="limitations">
              <summary>What remains unknown</summary>
              <ul>
                {plan.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </details>
          </section>
        )}
        <section id="how-it-works" className="how-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">THE DIFFERENCE IS CULTURAL</span>
              <h2>
                Three parts.
                <br />
                <em>No blurred lines.</em>
              </h2>
            </div>
            <p>
              We show the source of the suggestion
              <br />
              so you can make the final call.
            </p>
          </div>
          <div className="how-grid">
            <article>
              <span className="how-icon">◈</span>
              <small>THE INTERPRETER</small>
              <h3>AI reads the brief.</h3>
              <p>
                Gemini extracts an editable profile. It has no authority to
                invent venue facts, IDs, prices, or events. A rule-based option
                is labeled when used.
              </p>
            </article>
            <article>
              <span className="how-icon coral">⌁</span>
              <small>THE CULTURAL CONNECTION</small>
              <h3>Qloo finds the matches.</h3>
              <p>
                Confirmed artist, film and tag signals go into a
                location-filtered Qloo Insights query. Without Qloo results,
                there is no real cultural trail.
              </p>
            </article>
            <article>
              <span className="how-icon green">✳</span>
              <small>THE PRACTICAL LAYER</small>
              <h3>You keep the last word.</h3>
              <p>
                The app checks coordinates and suggests an order. You check
                hours, actual prices, suitability and availability before
                heading out.
              </p>
            </article>
          </div>
        </section>
      </main>
      <footer>
        <Link className="brand" href="/">
          <span className="brand-icon">⌁</span>
          <span>
            Tampa <b>Taste Trail</b>
          </span>
        </Link>
        <p>
          Qloo-grounded cultural discovery.
          <br />
          No bookings. No invented live events.
        </p>
        <div>
          <a
            href="https://docs.qloo.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            About Qloo ↗
          </a>
          <small>
            Independent hackathon prototype · no affiliation implied.
          </small>
        </div>
      </footer>
    </>
  );
}
