import { supabase } from '../../lib/supabase';
import { ApiError, rpc } from '../../lib/supabaseApi';
import type { DiscoverPlace } from './ranker';

export interface GroupSuggestion {
  id: string;
  name: string;
  reason?: string;
  url?: string;
  cuisineLabel?: string;
  priceNote?: string;
  source: 'participant' | 'admin';
  submittedBy?: string;
  osmRef?: string;
  lat?: number;
  lon?: number;
  createdAt: string;
}

export type Tally = { up: number; down: number };
export type VoteTarget = `suggestion:${string}` | `place:${string}`;

function db() {
  if (!supabase) throw new ApiError('De backend is niet geconfigureerd.');
  return supabase;
}

export const discoverApi = {
  places: () => rpc<DiscoverPlace[]>(db(), 'get_discover_places'),
  meta: () => rpc<{ updatedAt: string | null; exclusions: string[] }>(db(), 'get_discover_meta'),
  suggestions: () => rpc<GroupSuggestion[]>(db(), 'get_public_suggestions'),
  tallies: () => rpc<Record<string, Tally>>(db(), 'get_vote_tallies'),
  myVotes: () => rpc<Record<string, 1 | -1>>(db(), 'get_my_votes'),
  vote: (target: VoteTarget, value: -1 | 0 | 1) => {
    const [type, ...rest] = target.split(':');
    return rpc<Tally>(
      db(),
      'vote_suggestion',
      { p_target_type: type, p_target_id: rest.join(':'), p_value: value },
      'Stemmen is mislukt. Probeer het opnieuw.',
    );
  },
  submit: (name: string, reason: string, url: string, label: string) =>
    rpc<void>(
      db(),
      'submit_my_suggestion',
      { p_name: name, p_reason: reason, p_url: url, p_label: label },
      'Insturen is mislukt. Probeer het opnieuw.',
    ),
};
