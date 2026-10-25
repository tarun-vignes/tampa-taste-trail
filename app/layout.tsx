import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
export const metadata: Metadata = {
  title: 'Tampa Taste Trail — An outing with your kind of energy',
  description:
    'Connect your music, film, food and activity tastes to a Qloo-grounded Tampa outing. Clear sources. Honest unknowns.',
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
