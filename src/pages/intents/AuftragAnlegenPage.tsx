import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { KundenDialog } from '@/components/dialogs/KundenDialog';
import { MitarbeiterDialog } from '@/components/dialogs/MitarbeiterDialog';
import { MaterialDialog } from '@/components/dialogs/MaterialDialog';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import type { Kunden, Mitarbeiter, Material } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  IconUser,
  IconTool,
  IconPackage,
  IconCurrencyEuro,
  IconChevronRight,
  IconChevronLeft,
  IconCheck,
  IconPlus,
  IconClipboardList,
} from '@tabler/icons-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface FormData {
  auftragsnummer: string;
  auftragsdatum: string;
  arbeitsstunden: string;
  materialmenge: string;
  anfahrtspauschale: string;
  zusatzkosten: string;
  beschreibung: string;
  notizen: string;
}

// ─── Cost panel ──────────────────────────────────────────────────────────────

interface CostPanelProps {
  stundensatz: number;
  preis_pro_einheit: number;
  einheit: string;
  arbeitsstunden: number;
  materialmenge: number;
  anfahrtspauschale: number;
  zusatzkosten: number;
}

function CostPanel({
  stundensatz,
  preis_pro_einheit,
  einheit,
  arbeitsstunden,
  materialmenge,
  anfahrtspauschale,
  zusatzkosten,
}: CostPanelProps) {
  const arbeitskosten = arbeitsstunden * stundensatz;
  const materialkosten = materialmenge * preis_pro_einheit;
  const gesamt = arbeitskosten + materialkosten + anfahrtspauschale + zusatzkosten;

  const fmt = (v: number) =>
    v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <IconCurrencyEuro size={16} stroke={2} className="text-primary" />
        Kostenkalkulation
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">
            Arbeit ({arbeitsstunden} h &times; {fmt(stundensatz)}/h)
          </span>
          <span className="font-medium tabular-nums">{fmt(arbeitskosten)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">
            Material ({materialmenge} {einheit} &times; {fmt(preis_pro_einheit)})
          </span>
          <span className="font-medium tabular-nums">{fmt(materialkosten)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Anfahrtspauschale</span>
          <span className="font-medium tabular-nums">{fmt(anfahrtspauschale)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Zusatzkosten</span>
          <span className="font-medium tabular-nums">{fmt(zusatzkosten)}</span>
        </div>
        <div className="border-t pt-2 flex justify-between items-center">
          <span className="font-bold text-base">Gesamtpreis</span>
          <span className="font-bold text-base text-primary tabular-nums">{fmt(gesamt)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Summary row ─────────────────────────────────────────────────────────────

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2 border-b last:border-0">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right min-w-0 truncate">{value}</span>
    </div>
  );
}

// ─── Step nav buttons ─────────────────────────────────────────────────────────

interface StepNavProps {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  nextLoading?: boolean;
}

function StepNav({ onBack, onNext, nextLabel = 'Weiter', nextDisabled, nextLoading }: StepNavProps) {
  return (
    <div className="flex gap-3 mt-6">
      {onBack && (
        <Button variant="outline" onClick={onBack} className="gap-1.5">
          <IconChevronLeft size={16} stroke={2} />
          Zurück
        </Button>
      )}
      {onNext && (
        <Button onClick={onNext} disabled={nextDisabled || nextLoading} className="ml-auto gap-1.5">
          {nextLoading ? 'Bitte warten...' : nextLabel}
          {!nextLoading && <IconChevronRight size={16} stroke={2} />}
        </Button>
      )}
    </div>
  );
}

// ─── Wizard steps config ──────────────────────────────────────────────────────

const WIZARD_STEPS = [
  { label: 'Kunde' },
  { label: 'Mitarbeiter' },
  { label: 'Material' },
  { label: 'Details' },
  { label: 'Zusammenfassung' },
];

// ─── Main page component ──────────────────────────────────────────────────────

export default function AuftragAnlegenPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Data state ──
  const [kunden, setKunden] = useState<Kunden[]>([]);
  const [mitarbeiter, setMitarbeiter] = useState<Mitarbeiter[]>([]);
  const [material, setMaterial] = useState<Material[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<Error | null>(null);

  // ── Wizard state ──
  const [currentStep, setCurrentStep] = useState<number>(() => {
    const p = parseInt(searchParams.get('step') ?? '', 10);
    return p >= 1 && p <= 5 ? p : 1;
  });

  // ── Selection state ──
  const [selectedKunde, setSelectedKunde] = useState<Kunden | null>(null);
  const [selectedMitarbeiter, setSelectedMitarbeiter] = useState<Mitarbeiter | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);

  // ── Form state ──
  const [formData, setFormData] = useState<FormData>({
    auftragsnummer: '',
    auftragsdatum: new Date().toISOString().slice(0, 10),
    arbeitsstunden: '',
    materialmenge: '',
    anfahrtspauschale: '',
    zusatzkosten: '',
    beschreibung: '',
    notizen: '',
  });

  // ── Dialog state ──
  const [kundenDialogOpen, setKundenDialogOpen] = useState(false);
  const [mitarbeiterDialogOpen, setMitarbeiterDialogOpen] = useState(false);
  const [materialDialogOpen, setMaterialDialogOpen] = useState(false);

  // ── Submit state ──
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // ── Fetch all data ──
  const fetchAll = useCallback(async () => {
    setDataError(null);
    try {
      const [k, m, ma] = await Promise.all([
        LivingAppsService.getKunden(),
        LivingAppsService.getMitarbeiter(),
        LivingAppsService.getMaterial(),
      ]);
      setKunden(k);
      setMitarbeiter(m);
      setMaterial(ma);
    } catch (err) {
      setDataError(err instanceof Error ? err : new Error('Fehler beim Laden der Daten'));
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // ── Pre-select customer from URL param ──
  useEffect(() => {
    const kundeId = searchParams.get('kundeId');
    if (kundeId && kunden.length > 0 && !selectedKunde) {
      const found = kunden.find(k => k.record_id === kundeId);
      if (found) setSelectedKunde(found);
    }
  }, [kunden, searchParams, selectedKunde]);

  // ── Sync step to URL ──
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (currentStep > 1) {
      params.set('step', String(currentStep));
    } else {
      params.delete('step');
    }
    setSearchParams(params, { replace: true });
  }, [currentStep, searchParams, setSearchParams]);

  // ── Derived cost values ──
  const stundensatz = selectedMitarbeiter?.fields.stundensatz ?? 0;
  const preis_pro_einheit = selectedMaterial?.fields.preis_pro_einheit ?? 0;
  const einheitLabel =
    typeof selectedMaterial?.fields.einheit === 'object' && selectedMaterial.fields.einheit
      ? selectedMaterial.fields.einheit.label
      : '';
  const arbeitsstunden = parseFloat(formData.arbeitsstunden) || 0;
  const materialmenge = parseFloat(formData.materialmenge) || 0;
  const anfahrtspauschale = parseFloat(formData.anfahrtspauschale) || 0;
  const zusatzkosten = parseFloat(formData.zusatzkosten) || 0;

  const arbeitskosten = arbeitsstunden * stundensatz;
  const materialkosten = materialmenge * preis_pro_einheit;
  const gesamtpreis = arbeitskosten + materialkosten + anfahrtspauschale + zusatzkosten;

  const fmt = (v: number) =>
    v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

  // ── Navigation handlers ──
  function goNext() {
    setCurrentStep(s => Math.min(s + 1, 5));
  }
  function goBack() {
    setCurrentStep(s => Math.max(s - 1, 1));
  }

  // ── Submit ──
  async function handleSubmit() {
    if (!selectedKunde || !selectedMitarbeiter || !selectedMaterial) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await LivingAppsService.createAuftraegeEntry({
        auftragsnummer: formData.auftragsnummer || undefined,
        auftragsdatum: formData.auftragsdatum || undefined,
        status: 'offen',
        beschreibung: formData.beschreibung || undefined,
        kunde: createRecordUrl(APP_IDS.KUNDEN, selectedKunde.record_id),
        mitarbeiter_auftrag: createRecordUrl(APP_IDS.MITARBEITER, selectedMitarbeiter.record_id),
        material_auftrag: createRecordUrl(APP_IDS.MATERIAL, selectedMaterial.record_id),
        arbeitsstunden: arbeitsstunden || undefined,
        materialmenge: materialmenge || undefined,
        anfahrtspauschale: anfahrtspauschale || undefined,
        zusatzkosten: zusatzkosten || undefined,
        notizen_auftrag: formData.notizen || undefined,
      });
      setSuccess(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Auftrag konnte nicht erstellt werden.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Reset wizard ──
  function resetWizard() {
    setSelectedKunde(null);
    setSelectedMitarbeiter(null);
    setSelectedMaterial(null);
    setFormData({
      auftragsnummer: '',
      auftragsdatum: new Date().toISOString().slice(0, 10),
      arbeitsstunden: '',
      materialmenge: '',
      anfahrtspauschale: '',
      zusatzkosten: '',
      beschreibung: '',
      notizen: '',
    });
    setSubmitError(null);
    setSuccess(false);
    setCurrentStep(1);
  }

  // ── Success screen ──
  if (success) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col items-center justify-center py-20 gap-6">
          <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center">
            <IconCheck size={30} stroke={2.5} className="text-green-600" />
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground">Auftrag erstellt!</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Der Auftrag wurde erfolgreich angelegt und hat den Status{' '}
              <span className="font-medium text-amber-600">Offen</span>.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={resetWizard} className="gap-2">
              <IconPlus size={16} stroke={2} />
              Weiteren Auftrag anlegen
            </Button>
            <Button variant="outline" asChild>
              <a href="#/">Zum Dashboard</a>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render step content ──
  function renderStep() {
    switch (currentStep) {
      // ── Step 1: Kunde ──────────────────────────────────────────────────────
      case 1:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Kunde auswählen</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Wähle einen bestehenden Kunden oder lege einen neuen an.
              </p>
            </div>

            {selectedKunde && (
              <div className="flex items-center gap-3 p-4 rounded-xl border border-primary/40 bg-primary/5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <IconCheck size={16} stroke={2.5} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {selectedKunde.fields.vorname} {selectedKunde.fields.nachname}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[selectedKunde.fields.ort, selectedKunde.fields.telefon]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-xs"
                  onClick={() => setSelectedKunde(null)}
                >
                  Ändern
                </Button>
              </div>
            )}

            {!selectedKunde && (
              <EntitySelectStep
                items={kunden.map(k => ({
                  id: k.record_id,
                  title: `${k.fields.vorname ?? ''} ${k.fields.nachname ?? ''}`.trim() || '(Kein Name)',
                  subtitle: [k.fields.strasse, k.fields.hausnummer, k.fields.plz, k.fields.ort]
                    .filter(Boolean)
                    .join(' '),
                  icon: <IconUser size={16} stroke={2} className="text-primary" />,
                  stats: k.fields.telefon
                    ? [{ label: 'Tel.', value: k.fields.telefon }]
                    : [],
                }))}
                onSelect={(id) => {
                  const found = kunden.find(k => k.record_id === id);
                  if (found) setSelectedKunde(found);
                }}
                searchPlaceholder="Kunden suchen..."
                emptyText="Keine Kunden gefunden. Lege einen neuen an."
                emptyIcon={<IconUser size={32} />}
                createLabel="Neuen Kunden anlegen"
                onCreateNew={() => setKundenDialogOpen(true)}
                createDialog={
                  <KundenDialog
                    open={kundenDialogOpen}
                    onClose={() => setKundenDialogOpen(false)}
                    onSubmit={async (fields) => {
                      await LivingAppsService.createKundenEntry(fields);
                      await fetchAll();
                    }}
                  />
                }
              />
            )}

            <StepNav
              onNext={goNext}
              nextDisabled={!selectedKunde}
            />
          </div>
        );

      // ── Step 2: Mitarbeiter ────────────────────────────────────────────────
      case 2:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Mitarbeiter auswählen</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Welcher Mitarbeiter führt diesen Auftrag aus?
              </p>
            </div>

            {selectedMitarbeiter && (
              <div className="flex items-center gap-3 p-4 rounded-xl border border-primary/40 bg-primary/5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <IconCheck size={16} stroke={2.5} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {selectedMitarbeiter.fields.mitarbeiter_vorname}{' '}
                    {selectedMitarbeiter.fields.mitarbeiter_nachname}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {typeof selectedMitarbeiter.fields.gewerk === 'object' && selectedMitarbeiter.fields.gewerk
                      ? selectedMitarbeiter.fields.gewerk.label
                      : ''}
                    {selectedMitarbeiter.fields.stundensatz != null
                      ? ` · ${fmt(selectedMitarbeiter.fields.stundensatz)}/h`
                      : ''}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-xs"
                  onClick={() => setSelectedMitarbeiter(null)}
                >
                  Ändern
                </Button>
              </div>
            )}

            {!selectedMitarbeiter && (
              <EntitySelectStep
                items={mitarbeiter.map(m => ({
                  id: m.record_id,
                  title:
                    `${m.fields.mitarbeiter_vorname ?? ''} ${m.fields.mitarbeiter_nachname ?? ''}`.trim() ||
                    '(Kein Name)',
                  subtitle:
                    typeof m.fields.gewerk === 'object' && m.fields.gewerk
                      ? m.fields.gewerk.label
                      : '',
                  icon: <IconTool size={16} stroke={2} className="text-primary" />,
                  stats: m.fields.stundensatz != null
                    ? [{ label: 'Stundensatz', value: fmt(m.fields.stundensatz) + '/h' }]
                    : [],
                }))}
                onSelect={(id) => {
                  const found = mitarbeiter.find(m => m.record_id === id);
                  if (found) setSelectedMitarbeiter(found);
                }}
                searchPlaceholder="Mitarbeiter suchen..."
                emptyText="Keine Mitarbeiter gefunden. Lege einen neuen an."
                emptyIcon={<IconTool size={32} />}
                createLabel="Neuen Mitarbeiter anlegen"
                onCreateNew={() => setMitarbeiterDialogOpen(true)}
                createDialog={
                  <MitarbeiterDialog
                    open={mitarbeiterDialogOpen}
                    onClose={() => setMitarbeiterDialogOpen(false)}
                    onSubmit={async (fields) => {
                      await LivingAppsService.createMitarbeiterEntry(fields);
                      await fetchAll();
                    }}
                  />
                }
              />
            )}

            <StepNav
              onBack={goBack}
              onNext={goNext}
              nextDisabled={!selectedMitarbeiter}
            />
          </div>
        );

      // ── Step 3: Material ───────────────────────────────────────────────────
      case 3:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Material auswählen</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Welches Material wird für diesen Auftrag verwendet?
              </p>
            </div>

            {selectedMaterial && (
              <div className="flex items-center gap-3 p-4 rounded-xl border border-primary/40 bg-primary/5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <IconCheck size={16} stroke={2.5} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {selectedMaterial.fields.bezeichnung ?? '(Kein Name)'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {selectedMaterial.fields.preis_pro_einheit != null
                      ? fmt(selectedMaterial.fields.preis_pro_einheit)
                      : ''}
                    {typeof selectedMaterial.fields.einheit === 'object' && selectedMaterial.fields.einheit
                      ? ` / ${selectedMaterial.fields.einheit.label}`
                      : ''}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-xs"
                  onClick={() => setSelectedMaterial(null)}
                >
                  Ändern
                </Button>
              </div>
            )}

            {!selectedMaterial && (
              <EntitySelectStep
                items={material.map(m => ({
                  id: m.record_id,
                  title: m.fields.bezeichnung ?? '(Kein Name)',
                  subtitle:
                    typeof m.fields.einheit === 'object' && m.fields.einheit
                      ? m.fields.einheit.label
                      : '',
                  icon: <IconPackage size={16} stroke={2} className="text-primary" />,
                  stats: m.fields.preis_pro_einheit != null
                    ? [{ label: 'Preis', value: fmt(m.fields.preis_pro_einheit) + ' / Einheit' }]
                    : [],
                }))}
                onSelect={(id) => {
                  const found = material.find(m => m.record_id === id);
                  if (found) setSelectedMaterial(found);
                }}
                searchPlaceholder="Material suchen..."
                emptyText="Kein Material gefunden. Lege neues an."
                emptyIcon={<IconPackage size={32} />}
                createLabel="Neues Material anlegen"
                onCreateNew={() => setMaterialDialogOpen(true)}
                createDialog={
                  <MaterialDialog
                    open={materialDialogOpen}
                    onClose={() => setMaterialDialogOpen(false)}
                    onSubmit={async (fields) => {
                      await LivingAppsService.createMaterialEntry(fields);
                      await fetchAll();
                    }}
                  />
                }
              />
            )}

            <StepNav
              onBack={goBack}
              onNext={goNext}
              nextDisabled={!selectedMaterial}
            />
          </div>
        );

      // ── Step 4: Auftragsdetails ────────────────────────────────────────────
      case 4:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Auftragsdetails</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Gib alle Details zu diesem Auftrag ein.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="auftragsnummer">Auftragsnummer</Label>
                <Input
                  id="auftragsnummer"
                  placeholder="z.B. AU-2026-001"
                  value={formData.auftragsnummer}
                  onChange={e => setFormData(f => ({ ...f, auftragsnummer: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="auftragsdatum">Auftragsdatum</Label>
                <Input
                  id="auftragsdatum"
                  type="date"
                  value={formData.auftragsdatum}
                  onChange={e => setFormData(f => ({ ...f, auftragsdatum: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="arbeitsstunden">
                  Arbeitsstunden{' '}
                  <span className="text-muted-foreground font-normal text-xs">
                    (Stundensatz: {fmt(stundensatz)}/h)
                  </span>
                </Label>
                <Input
                  id="arbeitsstunden"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="0"
                  value={formData.arbeitsstunden}
                  onChange={e => setFormData(f => ({ ...f, arbeitsstunden: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="materialmenge">
                  Materialmenge{' '}
                  <span className="text-muted-foreground font-normal text-xs">
                    ({einheitLabel || 'Einheit'}, {fmt(preis_pro_einheit)} / Einheit)
                  </span>
                </Label>
                <Input
                  id="materialmenge"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={formData.materialmenge}
                  onChange={e => setFormData(f => ({ ...f, materialmenge: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="anfahrtspauschale">Anfahrtspauschale (€)</Label>
                <Input
                  id="anfahrtspauschale"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={formData.anfahrtspauschale}
                  onChange={e => setFormData(f => ({ ...f, anfahrtspauschale: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zusatzkosten">Zusatzkosten (€)</Label>
                <Input
                  id="zusatzkosten"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={formData.zusatzkosten}
                  onChange={e => setFormData(f => ({ ...f, zusatzkosten: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="beschreibung">Beschreibung</Label>
              <Textarea
                id="beschreibung"
                placeholder="Beschreibe den Auftrag..."
                rows={3}
                value={formData.beschreibung}
                onChange={e => setFormData(f => ({ ...f, beschreibung: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notizen">Notizen</Label>
              <Textarea
                id="notizen"
                placeholder="Interne Notizen..."
                rows={2}
                value={formData.notizen}
                onChange={e => setFormData(f => ({ ...f, notizen: e.target.value }))}
              />
            </div>

            <CostPanel
              stundensatz={stundensatz}
              preis_pro_einheit={preis_pro_einheit}
              einheit={einheitLabel}
              arbeitsstunden={arbeitsstunden}
              materialmenge={materialmenge}
              anfahrtspauschale={anfahrtspauschale}
              zusatzkosten={zusatzkosten}
            />

            <StepNav onBack={goBack} onNext={goNext} />
          </div>
        );

      // ── Step 5: Zusammenfassung ────────────────────────────────────────────
      case 5:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold">Zusammenfassung</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Prüfe alle Angaben vor dem Erstellen des Auftrags.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Kunde */}
              <div className="rounded-xl border bg-card p-4 space-y-1 overflow-hidden">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  <IconUser size={13} stroke={2} />
                  Kunde
                </div>
                <p className="font-medium text-sm truncate">
                  {selectedKunde?.fields.vorname} {selectedKunde?.fields.nachname}
                </p>
                {selectedKunde?.fields.strasse && (
                  <p className="text-xs text-muted-foreground truncate">
                    {selectedKunde.fields.strasse} {selectedKunde.fields.hausnummer},{' '}
                    {selectedKunde.fields.plz} {selectedKunde.fields.ort}
                  </p>
                )}
                {selectedKunde?.fields.telefon && (
                  <p className="text-xs text-muted-foreground">{selectedKunde.fields.telefon}</p>
                )}
              </div>

              {/* Mitarbeiter */}
              <div className="rounded-xl border bg-card p-4 space-y-1 overflow-hidden">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  <IconTool size={13} stroke={2} />
                  Mitarbeiter
                </div>
                <p className="font-medium text-sm truncate">
                  {selectedMitarbeiter?.fields.mitarbeiter_vorname}{' '}
                  {selectedMitarbeiter?.fields.mitarbeiter_nachname}
                </p>
                {typeof selectedMitarbeiter?.fields.gewerk === 'object' &&
                  selectedMitarbeiter?.fields.gewerk && (
                    <p className="text-xs text-muted-foreground">
                      {selectedMitarbeiter.fields.gewerk.label}
                    </p>
                  )}
                {selectedMitarbeiter?.fields.stundensatz != null && (
                  <p className="text-xs text-muted-foreground">
                    {fmt(selectedMitarbeiter.fields.stundensatz)}/h
                  </p>
                )}
              </div>

              {/* Material */}
              <div className="rounded-xl border bg-card p-4 space-y-1 overflow-hidden">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  <IconPackage size={13} stroke={2} />
                  Material
                </div>
                <p className="font-medium text-sm truncate">
                  {selectedMaterial?.fields.bezeichnung ?? '(Kein Name)'}
                </p>
                {typeof selectedMaterial?.fields.einheit === 'object' &&
                  selectedMaterial?.fields.einheit && (
                    <p className="text-xs text-muted-foreground">
                      {selectedMaterial.fields.einheit.label}
                    </p>
                  )}
                {selectedMaterial?.fields.preis_pro_einheit != null && (
                  <p className="text-xs text-muted-foreground">
                    {fmt(selectedMaterial.fields.preis_pro_einheit)} / Einheit
                  </p>
                )}
              </div>

              {/* Auftragsdetails */}
              <div className="rounded-xl border bg-card p-4 space-y-1 overflow-hidden">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  <IconClipboardList size={13} stroke={2} />
                  Auftragsdetails
                </div>
                <div className="text-sm space-y-0">
                  {formData.auftragsnummer && (
                    <SummaryRow label="Nr." value={formData.auftragsnummer} />
                  )}
                  <SummaryRow label="Datum" value={formData.auftragsdatum} />
                  <SummaryRow label="Stunden" value={`${arbeitsstunden} h`} />
                  <SummaryRow label="Menge" value={`${materialmenge} ${einheitLabel}`} />
                </div>
              </div>
            </div>

            {/* Cost panel */}
            <CostPanel
              stundensatz={stundensatz}
              preis_pro_einheit={preis_pro_einheit}
              einheit={einheitLabel}
              arbeitsstunden={arbeitsstunden}
              materialmenge={materialmenge}
              anfahrtspauschale={anfahrtspauschale}
              zusatzkosten={zusatzkosten}
            />

            {formData.beschreibung && (
              <div className="rounded-xl border bg-card p-4 space-y-1 overflow-hidden">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Beschreibung
                </p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{formData.beschreibung}</p>
              </div>
            )}

            {submitError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                <p className="text-sm text-destructive">{submitError}</p>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <Button variant="outline" onClick={goBack} className="gap-1.5">
                <IconChevronLeft size={16} stroke={2} />
                Zurück
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="ml-auto gap-2"
              >
                {submitting ? (
                  'Wird erstellt...'
                ) : (
                  <>
                    <IconCheck size={16} stroke={2.5} />
                    Auftrag erstellen ({fmt(gesamtpreis)})
                  </>
                )}
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  }

  return (
    <IntentWizardShell
      title="Neuen Auftrag anlegen"
      subtitle="Führe dich Schritt für Schritt durch die Auftragserstellung"
      steps={WIZARD_STEPS}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      loading={dataLoading}
      error={dataError}
      onRetry={fetchAll}
    >
      {renderStep()}
    </IntentWizardShell>
  );
}
