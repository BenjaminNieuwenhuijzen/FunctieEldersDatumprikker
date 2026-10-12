import { EmptyState } from '../../components/ui';

/** Fase C: bevestigde bezoeken (alleen na adminbevestiging). */
export function History() {
  return (
    <main id="main" className="mx-auto max-w-4xl px-5 pt-8">
      <p className="eyebrow">Geschiedenis</p>
      <h1 className="h-section mt-2 text-4xl">Eerdere etentjes</h1>
      <div className="mt-8">
        <EmptyState title="Nog niets vastgelegd">
          Bezoeken verschijnen hier pas nadat de beheerder datum en restaurant heeft bevestigd.
        </EmptyState>
      </div>
    </main>
  );
}
