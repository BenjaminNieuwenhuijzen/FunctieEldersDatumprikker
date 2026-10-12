import { EmptyState } from '../../components/ui';

/**
 * Fase B: inloggen via Supabase Auth. Autorisatie gebeurt server-side (RLS + rol-check);
 * deze pagina bevat bewust geen wachtwoord, geen geheime sleutel en geen isAdmin-vlag.
 */
export function Admin() {
  return (
    <main id="main" className="mx-auto max-w-3xl px-5 pt-8">
      <p className="eyebrow">Beheer</p>
      <h1 className="h-section mt-2 text-4xl">Inloggen</h1>
      <div className="mt-8">
        <EmptyState title="Beheer volgt met de database-koppeling">
          Inloggen werkt na het koppelen van Supabase Auth. Zie de README voor de stappen.
        </EmptyState>
      </div>
    </main>
  );
}
