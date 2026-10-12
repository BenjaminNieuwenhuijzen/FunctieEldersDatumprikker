import { useEffect, useState } from 'react';

export type AsyncState<T> =
  { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T };

/** Laadt asynchroon bij mount en wanneer `deps` wijzigen. De state begint zelf op 'loading'. */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    load().then(
      (data) => alive && setState({ status: 'ready', data }),
      (e: unknown) =>
        alive &&
        setState({ status: 'error', message: e instanceof Error ? e.message : 'Laden mislukt.' }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

export function Loading({ label = 'Laden…' }: { label?: string }) {
  return (
    <p role="status" className="py-16 text-center text-mist">
      {label}
    </p>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-2xl border border-coral/60 p-4 text-[#ff8f86]">
      {message}
    </p>
  );
}
