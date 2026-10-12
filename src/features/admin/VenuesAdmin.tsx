import { useState, type FormEvent } from 'react';
import { isHttpUrl } from '../../lib/validators';
import { ErrorNote, Loading, useAsync } from '../../lib/useAsync';
import { ActionError, useAction } from './AdminDashboard';
import { adminApi, slugify, type AdminVenue } from './adminApi';

type Draft = {
  name: string;
  city: string;
  tags: string;
  website: string;
  description: string;
  price: string;
  verified: boolean;
};

const toDraft = (v?: AdminVenue): Draft => ({
  name: v?.name ?? '',
  city: v?.city ?? 'Utrecht',
  tags: v?.cuisine_tags.join(', ') ?? '',
  website: v?.website_url ?? '',
  description: v?.description ?? '',
  price: v?.price_band ? String(v.price_band) : '',
  verified: !!v?.verified_at,
});

function fromDraft(d: Draft, existing?: AdminVenue): Partial<AdminVenue> {
  return {
    name: d.name.trim(),
    city: d.city.trim() || 'Utrecht',
    cuisine_tags: d.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 8),
    website_url: d.website.trim() || null,
    description: d.description.trim() || null,
    price_band: d.price ? Number(d.price) : null,
    verified_at: d.verified ? (existing?.verified_at ?? new Date().toISOString()) : null,
  };
}

function VenueForm({ venue, onSaved }: { venue?: AdminVenue; onSaved: () => void }) {
  const [d, setD] = useState<Draft>(toDraft(venue));
  const { busy, error, act } = useAction();
  const [local, setLocal] = useState('');
  const set = (k: keyof Draft) => (e: { target: { value: string } }) =>
    setD((x) => ({ ...x, [k]: e.target.value }));

  function submit(e: FormEvent) {
    e.preventDefault();
    setLocal('');
    if (!d.name.trim()) return setLocal('Naam is verplicht.');
    if (d.website.trim() && !isHttpUrl(d.website.trim()))
      return setLocal('Website moet met https:// beginnen.');
    const patch = fromDraft(d, venue);
    void act(
      () =>
        venue
          ? adminApi.updateVenue(venue.id, patch)
          : adminApi.createVenue({ ...patch, slug: slugify(`${d.name}-${d.city}`) }),
      () => {
        if (!venue) setD(toDraft());
        onSaved();
      },
    );
  }

  const id = venue?.id ?? 'new';
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">
        Naam
        <input
          id={`${id}-name`}
          className="field mt-1"
          maxLength={120}
          value={d.name}
          onChange={set('name')}
        />
      </label>
      <label className="text-sm">
        Plaats
        <input className="field mt-1" maxLength={80} value={d.city} onChange={set('city')} />
      </label>
      <label className="text-sm">
        Keuken/concept (komma-gescheiden)
        <input
          className="field mt-1"
          value={d.tags}
          onChange={set('tags')}
          placeholder="Bijv. Aziatisch, Sharing"
        />
      </label>
      <label className="text-sm">
        Officiële website
        <input
          className="field mt-1"
          inputMode="url"
          maxLength={300}
          value={d.website}
          onChange={set('website')}
        />
      </label>
      <label className="text-sm sm:col-span-2">
        Korte omschrijving
        <textarea
          className="field mt-1 min-h-20"
          maxLength={600}
          value={d.description}
          onChange={set('description')}
        />
      </label>
      <label className="text-sm">
        Prijsklasse
        <select className="field mt-1" value={d.price} onChange={set('price')}>
          <option value="">Onbekend</option>
          <option value="1">€</option>
          <option value="2">€€</option>
          <option value="3">€€€</option>
          <option value="4">€€€€</option>
        </select>
      </label>
      <label className="flex min-h-11 items-center gap-3 self-end text-sm">
        <input
          type="checkbox"
          className="h-5 w-5 accent-[var(--color-coral)]"
          checked={d.verified}
          onChange={(e) => setD((x) => ({ ...x, verified: e.target.checked }))}
        />
        Gegevens gecontroleerd
      </label>
      <div className="sm:col-span-2">
        <button className="btn btn-primary" disabled={busy}>
          {venue ? 'Opslaan' : 'Restaurant toevoegen'}
        </button>
        <ActionError error={local || error} />
      </div>
    </form>
  );
}

export function VenuesAdmin() {
  const [version, setVersion] = useState(0);
  const venues = useAsync(() => adminApi.listVenues(), [version]);
  const reload = () => setVersion((v) => v + 1);
  if (venues.status === 'loading') return <Loading />;
  if (venues.status === 'error') return <ErrorNote message={venues.message} />;
  return (
    <div className="space-y-6">
      <h2 className="text-2xl">Restaurantcatalogus</h2>
      <p className="max-w-2xl text-mist">
        Vul alleen gegevens in die je hebt gecontroleerd. Een omschrijving, prijsklasse of link
        verschijnt publiek op de restaurantkaart.
      </p>
      {venues.data.map((v) => (
        <details key={v.id} className="rounded-3xl border border-line bg-ink p-5 sm:p-6">
          <summary className="cursor-pointer text-xl font-semibold">
            {v.name} <span className="text-base font-normal text-mist">· {v.city}</span>
            {v.verified_at && <span className="chip ml-3">gecontroleerd</span>}
          </summary>
          <div className="mt-5">
            <VenueForm venue={v} onSaved={reload} />
          </div>
        </details>
      ))}
      <section className="rounded-3xl border border-dashed border-line p-5 sm:p-6">
        <h3 className="text-xl">Nieuw restaurant</h3>
        <div className="mt-4">
          <VenueForm onSaved={reload} />
        </div>
      </section>
    </div>
  );
}
