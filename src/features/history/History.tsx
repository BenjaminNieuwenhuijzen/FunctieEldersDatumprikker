import { EmptyState } from '../../components/ui';
import { api } from '../../lib/supabaseApi';
import { ErrorNote, Loading, useAsync } from '../../lib/useAsync';
import { Timeline } from './Timeline';

/** Bevestigde bezoeken (alleen na bevestiging door de beheerder). */
export function History() {
  const visits = useAsync(() => api.listVisits(), []);
  return (
    <main id="main" className="mx-auto max-w-4xl px-5 pt-8">
      <p className="eyebrow">Geschiedenis</p>
      <h1 className="h-section mt-2 text-4xl">Eerdere etentjes</h1>
      <div className="mt-10">
        {visits.status === 'loading' && <Loading />}
        {visits.status === 'error' && <ErrorNote message={visits.message} />}
        {visits.status === 'ready' &&
          (visits.data.length === 0 ? (
            <EmptyState title="Nog niets vastgelegd">
              Bezoeken verschijnen hier pas nadat de beheerder datum en restaurant heeft bevestigd.
            </EmptyState>
          ) : (
            <Timeline visits={visits.data} />
          ))}
      </div>
    </main>
  );
}
