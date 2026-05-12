import type { EnrichedAuftraege } from '@/types/enriched';
import type { Auftraege, Kunden, Material, Mitarbeiter } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface AuftraegeMaps {
  kundenMap: Map<string, Kunden>;
  mitarbeiterMap: Map<string, Mitarbeiter>;
  materialMap: Map<string, Material>;
}

export function enrichAuftraege(
  auftraege: Auftraege[],
  maps: AuftraegeMaps
): EnrichedAuftraege[] {
  return auftraege.map(r => ({
    ...r,
    kundeName: resolveDisplay(r.fields.kunde, maps.kundenMap, 'vorname', 'nachname'),
    mitarbeiter_auftragName: resolveDisplay(r.fields.mitarbeiter_auftrag, maps.mitarbeiterMap, 'mitarbeiter_vorname'),
    material_auftragName: resolveDisplay(r.fields.material_auftrag, maps.materialMap, 'bezeichnung'),
  }));
}
