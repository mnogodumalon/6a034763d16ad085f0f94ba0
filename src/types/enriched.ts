import type { Auftraege } from './app';

export type EnrichedAuftraege = Auftraege & {
  kundeName: string;
  mitarbeiter_auftragName: string;
  material_auftragName: string;
};
