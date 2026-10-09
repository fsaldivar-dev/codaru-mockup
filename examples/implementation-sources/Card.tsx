import type { ReactNode } from 'react';

export function Card({ title, header }: { title: string; header: ReactNode }) {
  return <article style={{ padding: 24, display: 'grid', gap: 16 }}>
    {header}
    <h2>{title}</h2>
  </article>;
}
