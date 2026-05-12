import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichAuftraege } from '@/lib/enrich';
import type { EnrichedAuftraege } from '@/types/enriched';
import type { Auftraege } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/StatCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AuftraegeDialog } from '@/components/dialogs/AuftraegeDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import {
  IconAlertCircle, IconTool, IconRefresh, IconCheck,
  IconPlus, IconPencil, IconTrash, IconClipboardList,
  IconUsers, IconUser, IconPackage, IconCurrencyEuro,
  IconChevronRight, IconClipboardCheck,
} from '@tabler/icons-react';

const APPGROUP_ID = '6a034763d16ad085f0f94ba0';
const REPAIR_ENDPOINT = '/claude/build/repair';

const STATUS_COLUMNS = [
  { key: 'offen', label: 'Offen', color: 'bg-amber-100 text-amber-800 border-amber-200', headerColor: 'bg-amber-50 border-amber-200' },
  { key: 'in_bearbeitung', label: 'In Bearbeitung', color: 'bg-blue-100 text-blue-800 border-blue-200', headerColor: 'bg-blue-50 border-blue-200' },
  { key: 'abgeschlossen', label: 'Abgeschlossen', color: 'bg-green-100 text-green-800 border-green-200', headerColor: 'bg-green-50 border-green-200' },
  { key: 'abgerechnet', label: 'Abgerechnet', color: 'bg-purple-100 text-purple-800 border-purple-200', headerColor: 'bg-purple-50 border-purple-200' },
  { key: 'storniert', label: 'Storniert', color: 'bg-red-100 text-red-800 border-red-200', headerColor: 'bg-red-50 border-red-200' },
] as const;

function getStatusStyle(key: string) {
  return STATUS_COLUMNS.find(c => c.key === key) ?? STATUS_COLUMNS[0];
}

export default function DashboardOverview() {
  const {
    kunden, material, mitarbeiter, auftraege,
    kundenMap, materialMap, mitarbeiterMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const enrichedAuftraege = enrichAuftraege(auftraege, { kundenMap, mitarbeiterMap, materialMap });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<EnrichedAuftraege | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EnrichedAuftraege | null>(null);
  const [prefilledStatus, setPrefilledStatus] = useState<string | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const stats = useMemo(() => {
    const offenCount = auftraege.filter(a => a.fields.status?.key === 'offen').length;
    const inBearbeitungCount = auftraege.filter(a => a.fields.status?.key === 'in_bearbeitung').length;
    const gesamtUmsatz = auftraege
      .filter(a => a.fields.status?.key === 'abgerechnet')
      .reduce((sum, a) => {
        const stunden = a.fields.arbeitsstunden ?? 0;
        const ma = mitarbeiterMap.get(a.fields.mitarbeiter_auftrag?.split('/').pop() ?? '');
        const stundensatz = ma?.fields.stundensatz ?? 0;
        const materialKosten = (a.fields.materialmenge ?? 0) * (materialMap.get(a.fields.material_auftrag?.split('/').pop() ?? '')?.fields.preis_pro_einheit ?? 0);
        return sum + stunden * stundensatz + materialKosten + (a.fields.anfahrtspauschale ?? 0) + (a.fields.zusatzkosten ?? 0);
      }, 0);
    return { offenCount, inBearbeitungCount, gesamtUmsatz };
  }, [auftraege, mitarbeiterMap, materialMap]);

  const grouped = useMemo(() => {
    const map: Record<string, EnrichedAuftraege[]> = {};
    for (const col of STATUS_COLUMNS) map[col.key] = [];
    for (const a of enrichedAuftraege) {
      const key = a.fields.status?.key ?? 'offen';
      if (map[key]) map[key].push(a);
    }
    return map;
  }, [enrichedAuftraege]);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  const handleCreate = async (fields: Auftraege['fields']) => {
    await LivingAppsService.createAuftraegeEntry(fields);
    fetchAll();
  };

  const handleEdit = async (fields: Auftraege['fields']) => {
    if (!editRecord) return;
    await LivingAppsService.updateAuftraegeEntry(editRecord.record_id, fields);
    fetchAll();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await LivingAppsService.deleteAuftraegeEntry(deleteTarget.record_id);
    setDeleteTarget(null);
    fetchAll();
  };

  const openCreate = (statusKey?: string) => {
    setEditRecord(null);
    setPrefilledStatus(statusKey ?? null);
    setDialogOpen(true);
  };

  const openEdit = (record: EnrichedAuftraege) => {
    setEditRecord(record);
    setPrefilledStatus(null);
    setDialogOpen(true);
  };

  const getDefaultValues = () => {
    if (editRecord) return editRecord.fields;
    if (prefilledStatus) {
      const opt = { key: prefilledStatus, label: STATUS_COLUMNS.find(c => c.key === prefilledStatus)?.label ?? prefilledStatus };
      return { status: opt };
    }
    return undefined;
  };

  const calcGesamtpreis = (a: EnrichedAuftraege) => {
    const stunden = a.fields.arbeitsstunden ?? 0;
    const maId = a.fields.mitarbeiter_auftrag?.split('/').pop() ?? '';
    const ma = mitarbeiterMap.get(maId);
    const stundensatz = ma?.fields.stundensatz ?? 0;
    const matId = a.fields.material_auftrag?.split('/').pop() ?? '';
    const mat = materialMap.get(matId);
    const materialPreis = (a.fields.materialmenge ?? 0) * (mat?.fields.preis_pro_einheit ?? 0);
    return stunden * stundensatz + materialPreis + (a.fields.anfahrtspauschale ?? 0) + (a.fields.zusatzkosten ?? 0);
  };

  return (
    <div className="space-y-6">
      {/* Workflow Intent Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <a href="#/intents/auftrag-anlegen" className="bg-card border border-border border-l-4 border-l-primary rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow flex items-center gap-3 min-w-0 overflow-hidden">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <IconPlus size={18} className="text-primary" stroke={2} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">Neuen Auftrag anlegen</p>
            <p className="text-xs text-muted-foreground truncate">Kunde, Mitarbeiter & Material in einem Schritt zuweisen</p>
          </div>
          <IconChevronRight size={16} className="text-muted-foreground shrink-0" stroke={2} />
        </a>
        <a href="#/intents/auftrag-abschliessen" className="bg-card border border-border border-l-4 border-l-primary rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow flex items-center gap-3 min-w-0 overflow-hidden">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <IconClipboardCheck size={18} className="text-primary" stroke={2} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">Auftrag abschließen & abrechnen</p>
            <p className="text-xs text-muted-foreground truncate">Stunden erfassen, Status setzen und Auftrag abrechnen</p>
          </div>
          <IconChevronRight size={16} className="text-muted-foreground shrink-0" stroke={2} />
        </a>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Offene Aufträge"
          value={String(stats.offenCount)}
          description="Noch nicht begonnen"
          icon={<IconClipboardList size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="In Bearbeitung"
          value={String(stats.inBearbeitungCount)}
          description="Aktive Aufträge"
          icon={<IconTool size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Kunden"
          value={String(kunden.length)}
          description="Gesamt"
          icon={<IconUsers size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Umsatz (abgerechnet)"
          value={stats.gesamtUmsatz > 0 ? formatCurrency(stats.gesamtUmsatz) : '0 €'}
          description="Abgerechnete Aufträge"
          icon={<IconCurrencyEuro size={18} className="text-muted-foreground" />}
        />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold">Auftragsübersicht</h2>
        <Button size="sm" onClick={() => openCreate()}>
          <IconPlus size={16} className="shrink-0 mr-1" />
          Neuer Auftrag
        </Button>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 items-start">
        {STATUS_COLUMNS.map(col => (
          <div key={col.key} className="flex flex-col gap-2 min-w-0">
            {/* Column header */}
            <div className={`flex items-center justify-between px-3 py-2 rounded-xl border ${col.headerColor}`}>
              <span className="text-xs font-semibold truncate">{col.label}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs font-medium text-muted-foreground">{grouped[col.key].length}</span>
                <button
                  onClick={() => openCreate(col.key)}
                  className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-black/10 transition-colors"
                  title={`Auftrag in "${col.label}" erstellen`}
                >
                  <IconPlus size={13} />
                </button>
              </div>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2">
              {grouped[col.key].length === 0 && (
                <div
                  className="flex flex-col items-center justify-center py-6 rounded-xl border border-dashed border-border text-muted-foreground cursor-pointer hover:bg-accent/30 transition-colors"
                  onClick={() => openCreate(col.key)}
                >
                  <IconPlus size={20} stroke={1.5} />
                  <span className="text-xs mt-1">Hinzufügen</span>
                </div>
              )}
              {grouped[col.key].map(auftrag => {
                const isExpanded = expandedCard === auftrag.record_id;
                const preis = calcGesamtpreis(auftrag);
                return (
                  <div
                    key={auftrag.record_id}
                    className="bg-card border border-border rounded-xl p-3 flex flex-col gap-2 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                  >
                    {/* Card header */}
                    <div className="flex items-start justify-between gap-1 min-w-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-mono text-muted-foreground truncate">{auftrag.fields.auftragsnummer ?? '—'}</p>
                        <p className="text-sm font-semibold truncate mt-0.5">{auftrag.kundeName || 'Kein Kunde'}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => openEdit(auftrag)}
                          className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-accent transition-colors text-muted-foreground"
                          title="Bearbeiten"
                        >
                          <IconPencil size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(auftrag)}
                          className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                          title="Löschen"
                        >
                          <IconTrash size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Beschreibung */}
                    {auftrag.fields.beschreibung && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{auftrag.fields.beschreibung}</p>
                    )}

                    {/* Meta */}
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {auftrag.fields.auftragsdatum && (
                        <span className="text-xs text-muted-foreground">{formatDate(auftrag.fields.auftragsdatum)}</span>
                      )}
                      {preis > 0 && (
                        <span className="text-xs font-medium text-foreground">{formatCurrency(preis)}</span>
                      )}
                    </div>

                    {/* Expand toggle */}
                    <button
                      className="text-xs text-primary hover:underline text-left w-fit"
                      onClick={() => setExpandedCard(isExpanded ? null : auftrag.record_id)}
                    >
                      {isExpanded ? 'Weniger' : 'Details'}
                    </button>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="border-t border-border pt-2 mt-1 flex flex-col gap-1.5">
                        {auftrag.mitarbeiter_auftragName && (
                          <div className="flex items-center gap-1.5 min-w-0">
                            <IconUser size={13} className="shrink-0 text-muted-foreground" />
                            <span className="text-xs truncate">{auftrag.mitarbeiter_auftragName}</span>
                          </div>
                        )}
                        {auftrag.material_auftragName && (
                          <div className="flex items-center gap-1.5 min-w-0">
                            <IconPackage size={13} className="shrink-0 text-muted-foreground" />
                            <span className="text-xs truncate">{auftrag.material_auftragName}{auftrag.fields.materialmenge ? ` × ${auftrag.fields.materialmenge}` : ''}</span>
                          </div>
                        )}
                        {(auftrag.fields.arbeitsstunden ?? 0) > 0 && (
                          <div className="flex items-center gap-1.5">
                            <IconTool size={13} className="shrink-0 text-muted-foreground" />
                            <span className="text-xs">{auftrag.fields.arbeitsstunden} h Arbeit</span>
                          </div>
                        )}
                        {auftrag.fields.notizen_auftrag && (
                          <p className="text-xs text-muted-foreground italic line-clamp-3">{auftrag.fields.notizen_auftrag}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Aufträge Dialog */}
      <AuftraegeDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditRecord(null); }}
        onSubmit={async (fields) => {
          if (editRecord) {
            await handleEdit(fields);
          } else {
            await handleCreate(fields);
          }
        }}
        defaultValues={getDefaultValues()}
        kundenList={kunden}
        mitarbeiterList={mitarbeiter}
        materialList={material}
        enablePhotoScan={AI_PHOTO_SCAN['Auftraege']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Auftraege']}
      />

      {/* Confirm Delete */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Auftrag löschen"
        description={`Auftrag "${deleteTarget?.fields.auftragsnummer ?? ''}" wirklich löschen?`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
      </div>
    </div>
  );
}

function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const [repairing, setRepairing] = useState(false);
  const [repairStatus, setRepairStatus] = useState('');
  const [repairDone, setRepairDone] = useState(false);
  const [repairFailed, setRepairFailed] = useState(false);

  const handleRepair = async () => {
    setRepairing(true);
    setRepairStatus('Reparatur wird gestartet...');
    setRepairFailed(false);

    const errorContext = JSON.stringify({
      type: 'data_loading',
      message: error.message,
      stack: (error.stack ?? '').split('\n').slice(0, 10).join('\n'),
      url: window.location.href,
    });

    try {
      const resp = await fetch(REPAIR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ appgroup_id: APPGROUP_ID, error_context: errorContext }),
      });

      if (!resp.ok || !resp.body) {
        setRepairing(false);
        setRepairFailed(true);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data: ')) continue;
          const content = line.slice(6);
          if (content.startsWith('[STATUS]')) {
            setRepairStatus(content.replace(/^\[STATUS]\s*/, ''));
          }
          if (content.startsWith('[DONE]')) {
            setRepairDone(true);
            setRepairing(false);
          }
          if (content.startsWith('[ERROR]') && !content.includes('Dashboard-Links')) {
            setRepairFailed(true);
          }
        }
      }
    } catch {
      setRepairing(false);
      setRepairFailed(true);
    }
  };

  if (repairDone) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <IconCheck size={22} className="text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-foreground mb-1">Dashboard repariert</h3>
          <p className="text-sm text-muted-foreground max-w-xs">Das Problem wurde behoben. Bitte laden Sie die Seite neu.</p>
        </div>
        <Button size="sm" onClick={() => window.location.reload()}>
          <IconRefresh size={14} className="mr-1" />Neu laden
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {repairing ? repairStatus : error.message}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry} disabled={repairing}>Erneut versuchen</Button>
        <Button size="sm" onClick={handleRepair} disabled={repairing}>
          {repairing
            ? <span className="inline-block w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-1" />
            : <IconTool size={14} className="mr-1" />}
          {repairing ? 'Reparatur läuft...' : 'Dashboard reparieren'}
        </Button>
      </div>
      {repairFailed && <p className="text-sm text-destructive">Automatische Reparatur fehlgeschlagen. Bitte kontaktieren Sie den Support.</p>}
    </div>
  );
}
