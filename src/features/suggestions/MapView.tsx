import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { KIND_STYLE, type MapPoint, type PointKind } from './mapTypes';

const reducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Popup als DOM (geen HTML-strings: namen komen uit externe data). */
function popupContent(p: MapPoint): HTMLElement {
  const box = document.createElement('div');
  box.className = 'fe-popup';
  const title = document.createElement('strong');
  title.textContent = p.name;
  box.appendChild(title);
  if (p.subtitle) {
    const sub = document.createElement('div');
    sub.textContent = p.subtitle;
    box.appendChild(sub);
  }
  const a = document.createElement('a');
  a.href = p.googleUrl;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.textContent = 'Google Maps & reviews ↗';
  box.appendChild(a);
  return box;
}

export default function MapView({
  points,
  focusId,
  onSelect,
}: {
  points: MapPoint[];
  focusId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef(new Map<string, L.CircleMarker>());

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, {
      center: [52.075, 5.105],
      zoom: 12,
      scrollWheelZoom: false,
      zoomAnimation: !reducedMotion(),
    });
    // OSM-standaardtegels (geen sleutel nodig); donker gemaakt via CSS (.fe-dark-tiles).
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      className: 'fe-dark-tiles',
      referrerPolicy: 'strict-origin-when-cross-origin',
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>-bijdragers',
    }).addTo(m);
    map.current = m;
    const markerMap = markers.current;
    return () => {
      m.remove();
      map.current = null;
      markerMap.clear();
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    markers.current.forEach((mk) => mk.remove());
    markers.current.clear();
    // Volgorde: bezocht onderop, groepssuggesties bovenop.
    const order: PointKind[] = ['visited', 'candidate', 'auto', 'group'];
    const sorted = [...points].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
    for (const p of sorted) {
      const s = KIND_STYLE[p.kind];
      const mk = L.circleMarker([p.lat, p.lon], {
        radius: p.kind === 'visited' ? 6 : 8,
        color: '#0c1220',
        weight: 2,
        fillColor: s.color,
        fillOpacity: 0.95,
      })
        .bindPopup(popupContent(p), { closeButton: true })
        .bindTooltip(p.name, { direction: 'top', offset: [0, -6] })
        .on('click', () => onSelect?.(p.id))
        .addTo(m);
      markers.current.set(p.id, mk);
    }
    if (points.length > 1) {
      m.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lon])), {
        padding: [30, 30],
        maxZoom: 14,
      });
    }
  }, [points, onSelect]);

  useEffect(() => {
    const m = map.current;
    const mk = focusId ? markers.current.get(focusId) : undefined;
    if (!m || !mk) return;
    m.flyTo(mk.getLatLng(), Math.max(m.getZoom(), 15), {
      animate: !reducedMotion(),
      duration: 0.6,
    });
    mk.openPopup();
  }, [focusId]);

  return (
    <div
      ref={el}
      className="h-[22rem] w-full overflow-hidden rounded-3xl border border-line sm:h-[28rem]"
      role="region"
      aria-label="Kaart met restaurants. De lijst hieronder bevat dezelfde informatie."
    />
  );
}
