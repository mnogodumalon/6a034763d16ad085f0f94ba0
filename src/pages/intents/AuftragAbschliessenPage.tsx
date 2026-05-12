import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService } from '@/services/livingAppsService';
import type { Auftraege } from '@/types/app';
import {
  IconClipboardCheck,
  IconChevronLeft,
  IconChevronRight,
  IconCheck,
  IconCurrencyEuro,
  IconTool,
  IconAlertCircle,
  IconRefresh,
} from '@tabler/icons-react';

const WIZARD_STEPS = [
  { label: 'Auftrag wählen' },
  { label: 'Details prüfen' },
  { label: 'Abschließen' },
];

function formatCurrency(value: number): string {
  return value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '–';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('de-DE');
}

interface FormData {
  arbeitsstunden: string;
  materialmenge: string;
  anfahrtspauschale: string;
  zusatzkosten: string;
  notizen: string;
}

export default function AuftragAbschliessenPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { auftraege, kundenMap, mitarbeiterMap, materialMap, loading, error, fetchAll } = useDashboardData();

  // Step initialised from URL ?step=
  const initialStep = (() => {
    const s = parseInt(searchParams.get('step') ?? '', 10);
    return s >= 1 && s <= 3 ? s : 1;
  })();

  const [currentStep, setCurrentStep] = useState(initialStep);
  const [selectedAuftrag, setSelectedAuftrag] = useState<Auftraege | null>(null);
  const [formData, setFormData] = useState<FormData>({
    arbeitsstunden: '',
    materialmenge: '',
    anfahrtspauschale: '',
    zusatzkosten: '',
    notizen: '',
  });
  const [selectedFinalStatus, setSelectedFinalStatus] = useState<'abgeschlossen' | 'abgerechnet'>('abgeschlossen');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Sync step to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    params.set('step', String(currentStep));
    setSearchParams(params, { replace: true });
  }, [currentStep, searchParams, setSearchParams]);

  // Pre-select auftrag from URL ?auftragId=
  useEffect(() => {
    const auftragId = searchParams.get('auftragId');
    if (auftragId && auftraege.length > 0 && !selectedAuftrag) {
      const found = auftraege.find(a => a.record_id === auftragId);
      if (found) {
        setSelectedAuftrag(found);
        setFormData({
          arbeitsstunden: String(found.fields.arbeitsstunden ?? ''),
          materialmenge: String(found.fields.materialmenge ?? ''),
          anfahrtspauschale: String(found.fields.anfahrtspauschale ?? ''),
          zusatzkosten: String(found.fields.zusatzkosten ?? ''),
          notizen: found.fields.notizen_auftrag ?? '',
        });
        if (currentStep === 1) setCurrentStep(2);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auftraege]);

  // Filter only offen / in_bearbeitung
  const offeneAuftraege = useMemo(
    () => auftraege.filter(a => {
      const key = typeof a.fields.status === 'object' && a.fields.status !== null
        ? (a.fields.status as { key: string }).key
        : a.fields.status;
      return key === 'offen' || key === 'in_bearbeitung';
    }),
    [auftraege]
  );

  // Cost calculation helpers
  const stundensatz = useMemo(() => {
    if (!selectedAuftrag?.fields.mitarbeiter_auftrag) return 0;
    const id = selectedAuftrag.fields.mitarbeiter_auftrag.split('/').pop() ?? '';
    return mitarbeiterMap.get(id)?.fields.stundensatz ?? 0;
  }, [selectedAuftrag, mitarbeiterMap]);

  const materialPreis = useMemo(() => {
    if (!selectedAuftrag?.fields.material_auftrag) return 0;
    const id = selectedAuftrag.fields.material_auftrag.split('/').pop() ?? '';
    return materialMap.get(id)?.fields.preis_pro_einheit ?? 0;
  }, [selectedAuftrag, materialMap]);

  const arbeitskosten = useMemo(() => {
    const h = parseFloat(formData.arbeitsstunden) || 0;
    return h * stundensatz;
  }, [formData.arbeitsstunden, stundensatz]);

  const materialkosten = useMemo(() => {
    const m = parseFloat(formData.materialmenge) || 0;
    return m * materialPreis;
  }, [formData.materialmenge, materialPreis]);

  const anfahrt = useMemo(() => parseFloat(formData.anfahrtspauschale) || 0, [formData.anfahrtspauschale]);
  const zusatz = useMemo(() => parseFloat(formData.zusatzkosten) || 0, [formData.zusatzkosten]);
  const gesamtpreis = useMemo(() => arbeitskosten + materialkosten + anfahrt + zusatz, [arbeitskosten, materialkosten, anfahrt, zusatz]);

  const handleSelectAuftrag = (id: string) => {
    const found = auftraege.find(a => a.record_id === id);
    if (!found) return;
    setSelectedAuftrag(found);
    setFormData({
      arbeitsstunden: String(found.fields.arbeitsstunden ?? ''),
      materialmenge: String(found.fields.materialmenge ?? ''),
      anfahrtspauschale: String(found.fields.anfahrtspauschale ?? ''),
      zusatzkosten: String(found.fields.zusatzkosten ?? ''),
      notizen: found.fields.notizen_auftrag ?? '',
    });
    setCurrentStep(2);
  };

  const handleSubmit = async () => {
    if (!selectedAuftrag) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await LivingAppsService.updateAuftraegeEntry(selectedAuftrag.record_id, {
        arbeitsstunden: parseFloat(formData.arbeitsstunden) || undefined,
        materialmenge: parseFloat(formData.materialmenge) || undefined,
        anfahrtspauschale: parseFloat(formData.anfahrtspauschale) || undefined,
        zusatzkosten: parseFloat(formData.zusatzkosten) || undefined,
        notizen_auftrag: formData.notizen || undefined,
        status: selectedFinalStatus,
      });
      await fetchAll();
      setSuccess(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSelectedAuftrag(null);
    setFormData({ arbeitsstunden: '', materialmenge: '', anfahrtspauschale: '', zusatzkosten: '', notizen: '' });
    setSelectedFinalStatus('abgeschlossen');
    setSubmitError(null);
    setSuccess(false);
    setCurrentStep(1);
  };

  const kundenName = useMemo(() => {
    if (!selectedAuftrag?.fields.kunde) return '–';
    const id = selectedAuftrag.fields.kunde.split('/').pop() ?? '';
    const k = kundenMap.get(id);
    if (!k) return '–';
    return [k.fields.vorname, k.fields.nachname].filter(Boolean).join(' ') || '–';
  }, [selectedAuftrag, kundenMap]);

  const mitarbeiterName = useMemo(() => {
    if (!selectedAuftrag?.fields.mitarbeiter_auftrag) return '–';
    const id = selectedAuftrag.fields.mitarbeiter_auftrag.split('/').pop() ?? '';
    const m = mitarbeiterMap.get(id);
    if (!m) return '–';
    return [m.fields.mitarbeiter_vorname, m.fields.mitarbeiter_nachname].filter(Boolean).join(' ') || '–';
  }, [selectedAuftrag, mitarbeiterMap]);

  const materialName = useMemo(() => {
    if (!selectedAuftrag?.fields.material_auftrag) return '–';
    const id = selectedAuftrag.fields.material_auftrag.split('/').pop() ?? '';
    return materialMap.get(id)?.fields.bezeichnung ?? '–';
  }, [selectedAuftrag, materialMap]);

  // Success screen
  if (success) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="rounded-2xl border bg-card shadow-lg overflow-hidden">
          <div className="bg-green-500/10 flex flex-col items-center gap-3 py-10 px-6 text-center border-b">
            <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center">
              <IconCheck size={28} className="text-green-600" stroke={2.5} />
            </div>
            <h2 className="text-xl font-bold text-foreground">Auftrag erfolgreich abgeschlossen!</h2>
            <p className="text-sm text-muted-foreground">
              Auftrag <span className="font-semibold">{selectedAuftrag?.fields.auftragsnummer ?? '–'}</span> wurde als{' '}
              <span className="font-semibold">
                {selectedFinalStatus === 'abgeschlossen' ? 'Abgeschlossen' : 'Abgerechnet'}
              </span>{' '}
              gespeichert.
            </p>
          </div>
          <div className="p-6 space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Kostenübersicht</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Arbeitskosten</span>
                <span>{formatCurrency(arbeitskosten)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Materialkosten</span>
                <span>{formatCurrency(materialkosten)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Anfahrtspauschale</span>
                <span>{formatCurrency(anfahrt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Zusatzkosten</span>
                <span>{formatCurrency(zusatz)}</span>
              </div>
              <div className="flex justify-between font-bold text-base border-t pt-2 mt-2">
                <span>Gesamtpreis</span>
                <span className="text-primary">{formatCurrency(gesamtpreis)}</span>
              </div>
            </div>
          </div>
          <div className="px-6 pb-6 flex flex-col sm:flex-row gap-3">
            <Button onClick={handleReset} className="flex-1 gap-2">
              <IconRefresh size={16} stroke={2} />
              Weiteren Auftrag abschließen
            </Button>
            <Button variant="outline" asChild className="flex-1">
              <a href="#/">Zum Dashboard</a>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <IntentWizardShell
      title="Auftrag abschließen & abrechnen"
      subtitle="Prüfe die Stunden und Materialien, dann schließe den Auftrag ab."
      steps={WIZARD_STEPS}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ─── Step 1: Auftrag auswählen ─── */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground mb-4">
              Wähle einen offenen oder in Bearbeitung befindlichen Auftrag aus, den du abschließen möchtest.
            </p>
            <EntitySelectStep
              items={offeneAuftraege.map(a => {
                const kundeId = a.fields.kunde?.split('/').pop() ?? '';
                const kunde = kundenMap.get(kundeId);
                const kundeName = kunde
                  ? [kunde.fields.vorname, kunde.fields.nachname].filter(Boolean).join(' ')
                  : '–';
                const statusObj = typeof a.fields.status === 'object' && a.fields.status !== null
                  ? (a.fields.status as { key: string; label: string })
                  : null;
                return {
                  id: a.record_id,
                  title: a.fields.auftragsnummer ?? `Auftrag ${a.record_id.slice(-6)}`,
                  subtitle: `${kundeName} · ${formatDate(a.fields.auftragsdatum)}`,
                  status: statusObj
                    ? { key: statusObj.key, label: statusObj.label }
                    : undefined,
                  stats: [
                    { label: 'Stunden', value: a.fields.arbeitsstunden ?? 0 },
                    { label: 'Menge', value: a.fields.materialmenge ?? 0 },
                  ],
                  icon: <IconTool size={20} className="text-primary" stroke={1.5} />,
                };
              })}
              onSelect={handleSelectAuftrag}
              searchPlaceholder="Suche nach Auftragsnummer oder Kunde..."
              emptyIcon={<IconClipboardCheck size={40} />}
              emptyText="Keine offenen Aufträge gefunden."
            />
          </div>
        </div>
      )}

      {/* ─── Step 2: Details prüfen & erfassen ─── */}
      {currentStep === 2 && selectedAuftrag && (
        <div className="space-y-4">
          {/* Auftrag-Info */}
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <h3 className="font-semibold text-base truncate">
                  {selectedAuftrag.fields.auftragsnummer ?? '–'}
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">{kundenName}</p>
              </div>
              <StatusBadge
                statusKey={
                  typeof selectedAuftrag.fields.status === 'object' && selectedAuftrag.fields.status !== null
                    ? (selectedAuftrag.fields.status as { key: string }).key
                    : (selectedAuftrag.fields.status ?? '')
                }
                label={
                  typeof selectedAuftrag.fields.status === 'object' && selectedAuftrag.fields.status !== null
                    ? (selectedAuftrag.fields.status as { label: string }).label
                    : (selectedAuftrag.fields.status ?? '')
                }
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 text-sm">
              <div>
                <span className="text-muted-foreground">Datum</span>
                <p className="font-medium">{formatDate(selectedAuftrag.fields.auftragsdatum)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Mitarbeiter</span>
                <p className="font-medium truncate">{mitarbeiterName}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Material</span>
                <p className="font-medium truncate">{materialName}</p>
              </div>
            </div>
            {selectedAuftrag.fields.beschreibung && (
              <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                {selectedAuftrag.fields.beschreibung}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Form */}
            <div className="rounded-xl border bg-card p-4 space-y-4">
              <h3 className="font-semibold text-sm">Zeiten & Mengen erfassen</h3>

              <div className="space-y-1">
                <Label htmlFor="arbeitsstunden" className="text-sm">Arbeitsstunden</Label>
                <Input
                  id="arbeitsstunden"
                  type="number"
                  min="0"
                  step="0.5"
                  value={formData.arbeitsstunden}
                  onChange={e => setFormData(p => ({ ...p, arbeitsstunden: e.target.value }))}
                  placeholder="z. B. 8"
                />
                {stundensatz > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Stundensatz: {formatCurrency(stundensatz)}/h
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="materialmenge" className="text-sm">Materialmenge</Label>
                <Input
                  id="materialmenge"
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.materialmenge}
                  onChange={e => setFormData(p => ({ ...p, materialmenge: e.target.value }))}
                  placeholder="z. B. 10"
                />
                {materialPreis > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Preis/Einheit: {formatCurrency(materialPreis)}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="anfahrt" className="text-sm">Anfahrtspauschale (€)</Label>
                <Input
                  id="anfahrt"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.anfahrtspauschale}
                  onChange={e => setFormData(p => ({ ...p, anfahrtspauschale: e.target.value }))}
                  placeholder="z. B. 25.00"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="zusatz" className="text-sm">Zusatzkosten (€)</Label>
                <Input
                  id="zusatz"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.zusatzkosten}
                  onChange={e => setFormData(p => ({ ...p, zusatzkosten: e.target.value }))}
                  placeholder="z. B. 0.00"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="notizen" className="text-sm">Notizen</Label>
                <Textarea
                  id="notizen"
                  value={formData.notizen}
                  onChange={e => setFormData(p => ({ ...p, notizen: e.target.value }))}
                  placeholder="Interne Anmerkungen zum Auftrag..."
                  rows={3}
                />
              </div>
            </div>

            {/* Live cost panel */}
            <div className="rounded-xl border bg-card p-4 space-y-3 h-fit">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <IconCurrencyEuro size={16} className="text-primary" stroke={2} />
                </div>
                <h3 className="font-semibold text-sm">Kostenübersicht</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Arbeitskosten</span>
                  <span className="font-medium tabular-nums">{formatCurrency(arbeitskosten)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Materialkosten</span>
                  <span className="font-medium tabular-nums">{formatCurrency(materialkosten)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Anfahrtspauschale</span>
                  <span className="font-medium tabular-nums">{formatCurrency(anfahrt)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Zusatzkosten</span>
                  <span className="font-medium tabular-nums">{formatCurrency(zusatz)}</span>
                </div>
                <div className="flex justify-between items-center font-bold text-base border-t pt-2 mt-2">
                  <span>Gesamtpreis</span>
                  <span className="text-primary tabular-nums">{formatCurrency(gesamtpreis)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between gap-3 pt-2">
            <Button variant="outline" onClick={() => setCurrentStep(1)} className="gap-2">
              <IconChevronLeft size={16} stroke={2} />
              Zurück
            </Button>
            <Button onClick={() => setCurrentStep(3)} className="gap-2">
              Weiter zur Bestätigung
              <IconChevronRight size={16} stroke={2} />
            </Button>
          </div>
        </div>
      )}

      {/* ─── Step 3: Abschließen ─── */}
      {currentStep === 3 && selectedAuftrag && (
        <div className="space-y-4">
          {/* Status auswählen */}
          <div className="rounded-xl border bg-card p-4">
            <h3 className="font-semibold text-sm mb-3">Endstatus wählen</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => setSelectedFinalStatus('abgeschlossen')}
                className={`p-4 rounded-xl border-2 text-left transition-colors ${
                  selectedFinalStatus === 'abgeschlossen'
                    ? 'border-green-500 bg-green-50'
                    : 'border-border bg-card hover:bg-accent'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                    <IconCheck size={12} stroke={2.5} /> Abgeschlossen
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Die Arbeit ist erledigt, aber noch nicht in Rechnung gestellt.
                </p>
              </button>

              <button
                onClick={() => setSelectedFinalStatus('abgerechnet')}
                className={`p-4 rounded-xl border-2 text-left transition-colors ${
                  selectedFinalStatus === 'abgerechnet'
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-border bg-card hover:bg-accent'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                    <IconCurrencyEuro size={12} stroke={2} /> Abgerechnet
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Die Rechnung wurde erstellt und dem Kunden zugeschickt.
                </p>
              </button>
            </div>
          </div>

          {/* Zusammenfassung */}
          <div className="rounded-xl border bg-card p-4">
            <h3 className="font-semibold text-sm mb-3">Zusammenfassung</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Auftragsnummer</span>
                  <span className="font-medium">{selectedAuftrag.fields.auftragsnummer ?? '–'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Kunde</span>
                  <span className="font-medium truncate ml-2 max-w-[150px] text-right">{kundenName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mitarbeiter</span>
                  <span className="font-medium truncate ml-2 max-w-[150px] text-right">{mitarbeiterName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Arbeitsstunden</span>
                  <span className="font-medium">{formData.arbeitsstunden || '0'} h</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Arbeitskosten</span>
                  <span className="tabular-nums">{formatCurrency(arbeitskosten)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Materialkosten</span>
                  <span className="tabular-nums">{formatCurrency(materialkosten)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Anfahrtspauschale</span>
                  <span className="tabular-nums">{formatCurrency(anfahrt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Zusatzkosten</span>
                  <span className="tabular-nums">{formatCurrency(zusatz)}</span>
                </div>
              </div>
            </div>
            <div className="flex justify-between items-center font-bold text-base border-t pt-3">
              <span>Gesamtpreis</span>
              <span className="text-primary tabular-nums text-lg">{formatCurrency(gesamtpreis)}</span>
            </div>
          </div>

          {submitError && (
            <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <IconAlertCircle size={16} stroke={2} />
              {submitError}
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between gap-3 pt-2">
            <Button variant="outline" onClick={() => setCurrentStep(2)} className="gap-2" disabled={submitting}>
              <IconChevronLeft size={16} stroke={2} />
              Zurück
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="gap-2 bg-green-600 hover:bg-green-700 text-white"
            >
              <IconClipboardCheck size={16} stroke={2} />
              {submitting ? 'Wird gespeichert...' : 'Auftrag abschließen'}
            </Button>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
