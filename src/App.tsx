import '@/lib/sentry';
import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorBusProvider } from '@/components/ErrorBus';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import AdminPage from '@/pages/AdminPage';
import KundenPage from '@/pages/KundenPage';
import MaterialPage from '@/pages/MaterialPage';
import MitarbeiterPage from '@/pages/MitarbeiterPage';
import AuftraegePage from '@/pages/AuftraegePage';
import PublicFormKunden from '@/pages/public/PublicForm_Kunden';
import PublicFormMaterial from '@/pages/public/PublicForm_Material';
import PublicFormMitarbeiter from '@/pages/public/PublicForm_Mitarbeiter';
import PublicFormAuftraege from '@/pages/public/PublicForm_Auftraege';
// <public:imports>
// </public:imports>
// <custom:imports>
const AuftragAnlegenPage = lazy(() => import('@/pages/intents/AuftragAnlegenPage'));
const AuftragAbschliessenPage = lazy(() => import('@/pages/intents/AuftragAbschliessenPage'));
// </custom:imports>

export default function App() {
  return (
    <ErrorBoundary>
      <ErrorBusProvider>
        <HashRouter>
          <ActionsProvider>
            <Routes>
              <Route path="public/6a0347345783ff1e978f88b1" element={<PublicFormKunden />} />
              <Route path="public/6a03473a600e28365a6638ef" element={<PublicFormMaterial />} />
              <Route path="public/6a03473a078bdcd9440ee803" element={<PublicFormMitarbeiter />} />
              <Route path="public/6a03473b1f67aeb35089c81c" element={<PublicFormAuftraege />} />
              {/* <public:routes> */}
              {/* </public:routes> */}
              <Route element={<Layout />}>
                <Route index element={<DashboardOverview />} />
                <Route path="kunden" element={<KundenPage />} />
                <Route path="material" element={<MaterialPage />} />
                <Route path="mitarbeiter" element={<MitarbeiterPage />} />
                <Route path="auftraege" element={<AuftraegePage />} />
                <Route path="admin" element={<AdminPage />} />
                {/* <custom:routes> */}
                <Route path="intents/auftrag-anlegen" element={<Suspense fallback={null}><AuftragAnlegenPage /></Suspense>} />
                <Route path="intents/auftrag-abschliessen" element={<Suspense fallback={null}><AuftragAbschliessenPage /></Suspense>} />
                {/* </custom:routes> */}
              </Route>
            </Routes>
          </ActionsProvider>
        </HashRouter>
      </ErrorBusProvider>
    </ErrorBoundary>
  );
}
