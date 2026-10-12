import { EmailGate } from '../../components/EmailGate';
import { signOut, useSession } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { ErrorNote, Loading, useAsync } from '../../lib/useAsync';
import { adminApi } from './adminApi';
import { AdminDashboard } from './AdminDashboard';

/**
 * Beheer. Inloggen met dezelfde e-mailcode als deelnemers; beheerrechten komen uit de tabel
 * `admins` en worden in de database afgedwongen (RLS). Deze pagina bevat geen geheimen.
 */
function AdminGate({ email }: { email: string }) {
  const check = useAsync(() => adminApi.amIAdmin(), [email]);
  if (check.status === 'loading') return <Loading label="Rechten controleren…" />;
  if (check.status === 'error') return <ErrorNote message={check.message} />;
  if (!check.data)
    return (
      <div className="rounded-3xl border border-line bg-ink p-6 sm:p-10">
        <h2 className="text-3xl">Geen beheerrechten</h2>
        <p className="mt-3 max-w-xl text-mist">
          Je bent ingelogd als <strong className="text-paper">{email}</strong>, maar dit account is
          geen beheerder. Een bestaande beheerder kan je toevoegen (zie docs/OPERATIONS.md).
        </p>
        <button type="button" className="btn mt-6" onClick={() => void signOut()}>
          Uitloggen
        </button>
      </div>
    );
  return <AdminDashboard email={email} />;
}

export function Admin() {
  const session = useSession();
  return (
    <main id="main" className="mx-auto max-w-6xl px-5 pt-8">
      <p className="eyebrow">Beheer</p>
      <h1 className="h-section mt-2 text-4xl">Functie Elders beheren</h1>
      <div className="mt-8">
        {!supabase ? (
          <ErrorNote message="De backend is niet geconfigureerd." />
        ) : session.status === 'loading' ? (
          <Loading />
        ) : session.session ? (
          <AdminGate email={session.session.user.email ?? ''} />
        ) : (
          <EmailGate intro="Log in met je e-mailadres. Alleen accounts met beheerrechten kunnen hier iets doen." />
        )}
      </div>
    </main>
  );
}
