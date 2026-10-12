# Design

**Richting**: premium uitnodiging, editorial. Donker, hoog contrast, één accent. Geen glazen
dashboardtegels, geen gradient-soep.

## Tokens

| Token          | Waarde                 | Gebruik                                      |
| -------------- | ---------------------- | -------------------------------------------- |
| `night`        | `#0c1220`              | achtergrond                                  |
| `ink`          | `#131b2e`              | vlakken/kaarten                              |
| `line`         | `#2b3652`              | randen                                       |
| `paper`        | `#f3efe6`              | primaire tekst (warm wit)                    |
| `mist`         | `#a3acc2`              | secundaire tekst (AA op night)               |
| `coral`        | `#ff5a4d`              | het ene accent                               |
| `yes/maybe/no` | groen/amber/rood-grijs | alleen met icoon + label, nooit kleur alleen |

## Typografie

- Display: **Bricolage Grotesque** (variabel), zware gewichten, krappe tracking.
- Body: **Instrument Sans**.
- Schaal: hero `clamp(3rem, 11vw, 9rem)`, h2 `clamp(1.75rem, 4vw, 3rem)`, body 1rem/1.6.

## Motief: de route

Een dunne lijn loopt door de pagina langs eerdere etentjes (stippen) naar het volgende
restaurant (accent-stip met puls). Component `RouteLine`. Statisch bij `prefers-reduced-motion`.

## Motion

Alleen betekenisvol: selectie van antwoord, stem bevestigd, balk-groei in resultaten, reveal bij
scroll. `prefers-reduced-motion: reduce` zet alles uit. Geen confetti.

## Componenten

Button, Chip, VenueCard, AvailabilityMatrix (vanaf md) / DateCards (mobiel), ResultBar,
RouteLine, EmptyState, Field. Zie `#/design` in de app.

## Toegankelijkheid (WCAG 2.2 AA)

Zichtbare focusring (2px coral + offset), doellocaties minimaal 44px, antwoorden als
`radiogroup`, live-regio voor bevestiging, `lang="nl"`, skip-link, contrast minimaal 4.5:1.

## Afbeeldingen

Alleen eigen uploads of rechtenvrij. Tot die tijd: typografische placeholders per restaurant.
