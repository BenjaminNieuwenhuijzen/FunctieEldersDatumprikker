// Gedeeld tussen de (lazy geladen) kaart en de Ontdek-pagina, zodat Leaflet pas laadt als de kaart rendert.
export type PointKind = 'group' | 'auto' | 'visited' | 'candidate';

export interface MapPoint {
  id: string;
  lat: number;
  lon: number;
  name: string;
  subtitle?: string;
  kind: PointKind;
  googleUrl: string;
}

export const KIND_STYLE: Record<PointKind, { color: string; label: string }> = {
  group: { color: '#5ed39b', label: 'Suggestie van de groep' },
  auto: { color: '#ff5a4d', label: 'Automatische suggestie' },
  candidate: { color: '#f2b84b', label: 'Kandidaat volgend etentje' },
  visited: { color: '#a3acc2', label: 'Al bezocht' },
};
