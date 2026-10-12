import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { EmptyState } from '../../components/ui';
import { Results } from '../availability/Results';
import { VoteForm } from '../availability/VoteForm';
import { ErrorNote, Loading, useAsync } from '../../lib/useAsync';

export function EventPage() {
  const { slug = '' } = useParams();
  const state = useAsync(async () => {
    const event = await api.getEventBySlug(slug);
    return event ? { event, tally: await api.getTally(event.id) } : null;
  }, [slug]);

  return (
    <main id="main" className="mx-auto max-w-4xl px-5 pt-8">
      {state.status === 'loading' && <Loading />}
      {state.status === 'error' && <ErrorNote message={state.message} />}
      {state.status === 'ready' && !state.data && (
        <EmptyState
          title="Dit etentje bestaat niet (meer)"
          action={
            <Link to="/" className="btn">
              Naar home
            </Link>
          }
        >
          Controleer de link, of vraag de organisator om een nieuwe.
        </EmptyState>
      )}
      {state.status === 'ready' && state.data && (
        <>
          <p className="eyebrow">
            {state.data.event.status === 'open' ? 'Poll open' : 'Poll gesloten'}
          </p>
          <h1 className="h-section mt-2 text-4xl">{state.data.event.title}</h1>
          {state.data.event.status !== 'open' && (
            <p className="mt-4 rounded-2xl border border-line p-4">
              Deze poll is gesloten. Stemmen of aanpassen is niet meer mogelijk.
            </p>
          )}
          <div className="mt-10">
            <VoteForm
              event={state.data.event}
              onSubmit={(p) => api.submitVote(state.data!.event.id, p)}
            />
          </div>
          <div className="mt-20">
            <Results event={state.data.event} tally={state.data.tally} />
          </div>
        </>
      )}
    </main>
  );
}
