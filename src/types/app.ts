// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export interface Kunden {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    vorname?: string;
    nachname?: string;
    strasse?: string;
    hausnummer?: string;
    plz?: string;
    ort?: string;
    telefon?: string;
    email?: string;
    notizen_kunde?: string;
  };
}

export interface Material {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    bezeichnung?: string;
    einheit?: LookupValue;
    preis_pro_einheit?: number;
    notizen_material?: string;
  };
}

export interface Mitarbeiter {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    mitarbeiter_vorname?: string;
    mitarbeiter_nachname?: string;
    gewerk?: LookupValue;
    stundensatz?: number;
    telefon_mitarbeiter?: string;
    email_mitarbeiter?: string;
  };
}

export interface Auftraege {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    auftragsnummer?: string;
    auftragsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    status?: LookupValue;
    beschreibung?: string;
    kunde?: string; // applookup -> URL zu 'Kunden' Record
    mitarbeiter_auftrag?: string; // applookup -> URL zu 'Mitarbeiter' Record
    arbeitsstunden?: number;
    material_auftrag?: string; // applookup -> URL zu 'Material' Record
    materialmenge?: number;
    anfahrtspauschale?: number;
    zusatzkosten?: number;
    notizen_auftrag?: string;
  };
}

export const APP_IDS = {
  KUNDEN: '6a0347345783ff1e978f88b1',
  MATERIAL: '6a03473a600e28365a6638ef',
  MITARBEITER: '6a03473a078bdcd9440ee803',
  AUFTRAEGE: '6a03473b1f67aeb35089c81c',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'material': {
    einheit: [{ key: "stueck", label: "Stück" }, { key: "meter", label: "Meter" }, { key: "liter", label: "Liter" }, { key: "kilogramm", label: "Kilogramm" }, { key: "quadratmeter", label: "Quadratmeter" }, { key: "kubikmeter", label: "Kubikmeter" }, { key: "rolle", label: "Rolle" }, { key: "paket", label: "Paket" }, { key: "sack", label: "Sack" }],
  },
  'mitarbeiter': {
    gewerk: [{ key: "maler", label: "Maler" }, { key: "elektriker", label: "Elektriker" }, { key: "schreiner", label: "Schreiner" }, { key: "sanitaer", label: "Sanitär" }, { key: "fliesenleger", label: "Fliesenleger" }, { key: "maurer", label: "Maurer" }, { key: "sonstiges", label: "Sonstiges" }],
  },
  'auftraege': {
    status: [{ key: "offen", label: "Offen" }, { key: "in_bearbeitung", label: "In Bearbeitung" }, { key: "abgeschlossen", label: "Abgeschlossen" }, { key: "abgerechnet", label: "Abgerechnet" }, { key: "storniert", label: "Storniert" }],
  },
};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'kunden': {
    'vorname': 'string/text',
    'nachname': 'string/text',
    'strasse': 'string/text',
    'hausnummer': 'string/text',
    'plz': 'string/text',
    'ort': 'string/text',
    'telefon': 'string/tel',
    'email': 'string/email',
    'notizen_kunde': 'string/textarea',
  },
  'material': {
    'bezeichnung': 'string/text',
    'einheit': 'lookup/select',
    'preis_pro_einheit': 'number',
    'notizen_material': 'string/textarea',
  },
  'mitarbeiter': {
    'mitarbeiter_vorname': 'string/text',
    'mitarbeiter_nachname': 'string/text',
    'gewerk': 'lookup/select',
    'stundensatz': 'number',
    'telefon_mitarbeiter': 'string/tel',
    'email_mitarbeiter': 'string/email',
  },
  'auftraege': {
    'auftragsnummer': 'string/text',
    'auftragsdatum': 'date/date',
    'status': 'lookup/select',
    'beschreibung': 'string/textarea',
    'kunde': 'applookup/select',
    'mitarbeiter_auftrag': 'applookup/select',
    'arbeitsstunden': 'number',
    'material_auftrag': 'applookup/select',
    'materialmenge': 'number',
    'anfahrtspauschale': 'number',
    'zusatzkosten': 'number',
    'notizen_auftrag': 'string/textarea',
  },
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateKunden = StripLookup<Kunden['fields']>;
export type CreateMaterial = StripLookup<Material['fields']>;
export type CreateMitarbeiter = StripLookup<Mitarbeiter['fields']>;
export type CreateAuftraege = StripLookup<Auftraege['fields']>;