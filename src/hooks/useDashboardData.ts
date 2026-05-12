import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Kunden, Material, Mitarbeiter, Auftraege } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';

export function useDashboardData() {
  const [kunden, setKunden] = useState<Kunden[]>([]);
  const [material, setMaterial] = useState<Material[]>([]);
  const [mitarbeiter, setMitarbeiter] = useState<Mitarbeiter[]>([]);
  const [auftraege, setAuftraege] = useState<Auftraege[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [kundenData, materialData, mitarbeiterData, auftraegeData] = await Promise.all([
        LivingAppsService.getKunden(),
        LivingAppsService.getMaterial(),
        LivingAppsService.getMitarbeiter(),
        LivingAppsService.getAuftraege(),
      ]);
      setKunden(kundenData);
      setMaterial(materialData);
      setMitarbeiter(mitarbeiterData);
      setAuftraege(auftraegeData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fehler beim Laden der Daten'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Silent background refresh (no loading state change → no flicker)
  useEffect(() => {
    async function silentRefresh() {
      try {
        const [kundenData, materialData, mitarbeiterData, auftraegeData] = await Promise.all([
          LivingAppsService.getKunden(),
          LivingAppsService.getMaterial(),
          LivingAppsService.getMitarbeiter(),
          LivingAppsService.getAuftraege(),
        ]);
        setKunden(kundenData);
        setMaterial(materialData);
        setMitarbeiter(mitarbeiterData);
        setAuftraege(auftraegeData);
      } catch {
        // silently ignore — stale data is better than no data
      }
    }
    function handleRefresh() { void silentRefresh(); }
    window.addEventListener('dashboard-refresh', handleRefresh);
    return () => window.removeEventListener('dashboard-refresh', handleRefresh);
  }, []);

  const kundenMap = useMemo(() => {
    const m = new Map<string, Kunden>();
    kunden.forEach(r => m.set(r.record_id, r));
    return m;
  }, [kunden]);

  const materialMap = useMemo(() => {
    const m = new Map<string, Material>();
    material.forEach(r => m.set(r.record_id, r));
    return m;
  }, [material]);

  const mitarbeiterMap = useMemo(() => {
    const m = new Map<string, Mitarbeiter>();
    mitarbeiter.forEach(r => m.set(r.record_id, r));
    return m;
  }, [mitarbeiter]);

  return { kunden, setKunden, material, setMaterial, mitarbeiter, setMitarbeiter, auftraege, setAuftraege, loading, error, fetchAll, kundenMap, materialMap, mitarbeiterMap };
}