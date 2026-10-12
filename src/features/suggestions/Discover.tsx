import { EmptyState } from '../../components/ui';

/** Fase C/D: gemodereerde suggesties, "lijkt me leuk/niks"-reacties en uitlegbare aanbevelingen. */
export function Discover() {
  return (
    <main id="main" className="mx-auto max-w-4xl px-5 pt-8">
      <p className="eyebrow">Ontdek</p>
      <h1 className="h-section mt-2 text-4xl">De volgende plek</h1>
      <div className="mt-8">
        <EmptyState title="Hier komen restaurantideeën">
          Suggesties van de groep verschijnen hier nadat de beheerder ze heeft goedgekeurd, met
          uitleg waarom iets wordt voorgesteld.
        </EmptyState>
      </div>
    </main>
  );
}
