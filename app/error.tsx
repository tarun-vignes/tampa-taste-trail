'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <h1>Let’s get your trail back.</h1>
      <p>
        The page could not finish loading. Your preferences are not stored as a
        profile.
      </p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
