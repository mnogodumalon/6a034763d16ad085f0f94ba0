import type { Auftraege, Kunden, Mitarbeiter, Material } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { IconPencil } from '@tabler/icons-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

function formatDate(d?: string) {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd.MM.yyyy', { locale: de }); } catch { return d; }
}

interface AuftraegeViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Auftraege | null;
  onEdit: (record: Auftraege) => void;
  kundenList: Kunden[];
  mitarbeiterList: Mitarbeiter[];
  materialList: Material[];
}

export function AuftraegeViewDialog({ open, onClose, record, onEdit, kundenList, mitarbeiterList, materialList }: AuftraegeViewDialogProps) {
  function getKundenDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return kundenList.find(r => r.record_id === id)?.fields.vorname ?? '—';
  }

  function getMitarbeiterDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return mitarbeiterList.find(r => r.record_id === id)?.fields.mitarbeiter_vorname ?? '—';
  }

  function getMaterialDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return materialList.find(r => r.record_id === id)?.fields.bezeichnung ?? '—';
  }

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Aufträge anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Auftragsnummer</Label>
            <p className="text-sm">{record.fields.auftragsnummer ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Auftragsdatum</Label>
            <p className="text-sm">{formatDate(record.fields.auftragsdatum)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Badge variant="secondary">{record.fields.status?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Auftragsbeschreibung</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.beschreibung ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Kunde</Label>
            <p className="text-sm">{getKundenDisplayName(record.fields.kunde)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Mitarbeiter</Label>
            <p className="text-sm">{getMitarbeiterDisplayName(record.fields.mitarbeiter_auftrag)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Arbeitsstunden (h)</Label>
            <p className="text-sm">{record.fields.arbeitsstunden ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Material</Label>
            <p className="text-sm">{getMaterialDisplayName(record.fields.material_auftrag)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Menge</Label>
            <p className="text-sm">{record.fields.materialmenge ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Anfahrtspauschale (€)</Label>
            <p className="text-sm">{record.fields.anfahrtspauschale ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Zusatzkosten (€)</Label>
            <p className="text-sm">{record.fields.zusatzkosten ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Notizen zum Auftrag</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.notizen_auftrag ?? '—'}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}