import { Link } from 'react-router-dom';
import { EmptyState } from '../../components/ui';

/** Fase B: laadt het eigen antwoord via update-vote met de bewerkcode. Nog niet actief. */
export function EditPage() {
  return (
    <main id="main" className="mx-auto max-w-3xl px-5 pt-8">
      <EmptyState
        title="Bewerken is nog niet beschikbaar"
        action={
          <Link to="/" className="btn">
            Naar home
          </Link>
        }
      >
        Zodra de opslag is gekoppeld, kun je hier met je persoonlijke link je antwoord aanpassen.
      </EmptyState>
    </main>
  );
}
