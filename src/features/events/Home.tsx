import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { describeDate } from '../../lib/format';
import { EmptyState, RouteLine, VenueCard } from '../../components/ui';
import { ErrorNote, Loading, useAsync } from '../../lib/useAsync';

export function Home() {
  const state = useAsync(
    async () => ({ event: await api.getActiveEvent(), venues: await api.listVenues() }),
    [],
  );

  return (
    <main id="main" className="mx-auto max-w-6xl px-5">
      <section className="reveal pb-16 pt-10 sm:pt-20">
        <p className="eyebrow">Oud-collega's · regio Utrecht</p>
        <h1 className="h-display mt-5">
          Functie
          <br />
          <span className="text-coral">Elders.</span>
        </h1>
        <p className="mt-6 max-w-xl text-xl text-mist">De beste plannen ontstaan buiten kantoor.</p>
        <RouteLine className="mt-10 w-full max-w-2xl" />
      </section>

      {state.status === 'loading' && <Loading />}
      {state.status === 'error' && <ErrorNote message={state.message} />}
      {state.status === 'ready' && (
        <>
          <section aria-labelledby="next-h" className="pb-20">
            <p className="eyebrow">Volgende bijeenkomst</p>
            <h2 id="next-h" className="h-section mt-2">
              Het volgende etentje
            </h2>
            <div className="mt-8">
              {state.data.event ? (
                <div className="rounded-3xl border border-line bg-ink p-6 sm:p-10">
                  <h3 className="text-3xl">{state.data.event.title}</h3>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {state.data.event.dateOptions.map((d) => (
                      <li key={d.id} className="chip capitalize">
                        {describeDate(d)}
                      </li>
                    ))}
                  </ul>
                  <Link to={`/event/${state.data.event.slug}`} className="btn btn-primary mt-8">
                    Stem mee
                  </Link>
                </div>
              ) : (
                <EmptyState
                  title="De datums volgen nog"
                  action={
                    <Link to="/ontdek" className="btn">
                      Stel alvast een restaurant voor
                    </Link>
                  }
                >
                  Zodra er datums zijn geprikt, kun je hier meestemmen. Je hoeft geen account aan te
                  maken.
                </EmptyState>
              )}
            </div>
          </section>

          <section aria-labelledby="venues-h" className="pb-20">
            <p className="eyebrow">Kandidaten eerste etentje</p>
            <h2 id="venues-h" className="h-section mt-2">
              Waar gaan we eten?
            </h2>
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {state.data.venues.map((v, i) => (
                <VenueCard key={v.id} venue={v} index={i} />
              ))}
            </div>
          </section>

          <section aria-labelledby="hist-h" className="pb-8">
            <p className="eyebrow">Eerder</p>
            <h2 id="hist-h" className="h-section mt-2">
              De route tot nu toe
            </h2>
            <div className="mt-8">
              <EmptyState
                title="Nog geen etentjes vastgelegd"
                action={
                  <Link to="/geschiedenis" className="btn">
                    Naar de geschiedenis
                  </Link>
                }
              >
                Na elk etentje legt de beheerder datum en restaurant vast. Dan groeit hier de route.
              </EmptyState>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
