
import React, { useEffect, useMemo, useState } from "react";
import { Button } from "./components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";
import {
  Upload,
  Plus,
  ShieldCheck,
  Bell,
  Download,
} from "lucide-react";
import { motion } from "framer-motion";

import {
  getPersonId,
  asYearOrNull,
  formatCenturyLabel,
  boolFromVerified,
  verifiedToText,
  rowDisplayName,
} from "./lib/data";
import type { RawRow, Person } from "./lib/types";

// Componentes
import { Notification } from "./components/ui/notification";
import { StatsTab } from "./components/tabs/stats-tab";
import { FichasTab } from "./components/tabs/fichas-tab";
import { DataTab } from "./components/tabs/data-tab";
import { TimelineTab } from "./components/tabs/timeline-tab";
import { ComparativaTab } from "./components/tabs/comparativa-tab";
import { EditorDialog, DeleteDialog } from "./components/editors/editors";

// Hook y Contexto
import { useDataset } from "./hooks/useDataset";
import { AppProvider, useAppContext } from "./context/AppContext";

// ---------------------------------------------------------------------------
// Componente raíz: inyecta AppProvider
// ---------------------------------------------------------------------------
export default function ReyesApp() {
  const dataset = useDataset();

  return (
    <AppProvider rows={dataset.rows} idbLoaded={dataset.idbLoaded} datasetLoadedAt={dataset.datasetLoadedAt}>
      <ReyesAppInner dataset={dataset} />
    </AppProvider>
  );
}

// ---------------------------------------------------------------------------
// Componente interior (consume el contexto)
// ---------------------------------------------------------------------------
function ReyesAppInner({ dataset }: { dataset: ReturnType<typeof useDataset> }) {
  const {
    fileRef,
    rawText,
    detectedDelimiter,
    detectedQuotes,
    error,
    setError,
    datasetName,
    setDatasetName,
    datasetChecks,
    handleFile,
    commitPersonDraft,
    commitRowDraft,
    addRowForPerson,
    removeRow,
    removePerson,
    exportCsv,
    rows,
  } = dataset;

  const {
    people,
    allPeople,
    filters,
    setFilters,
    reinos,
    dinastias,
    siglos,
    selectedPersonId,
    setSelectedPersonId,
    selectedPerson,
    globalStats,
    filteredStats,
    selectedCenturies,
  } = useAppContext();

  // --- Notificaciones ---
  const [showCsvNotice, setShowCsvNotice] = useState(true);
  const [showChecksNotice, setShowChecksNotice] = useState(true);
  const [showErrorNotice, setShowErrorNotice] = useState(true);
  const [showNoticeCenter, setShowNoticeCenter] = useState(false);

  // --- Rutas y sincronización ---
  const navigate = useNavigate();
  const location = useLocation();

  let activeTab = "fichas";
  if (location.pathname.startsWith("/estadistica")) activeTab = "estadistica";
  else if (location.pathname.startsWith("/datos")) activeTab = "datos";
  else if (location.pathname.startsWith("/timeline")) activeTab = "timeline";
  else if (location.pathname.startsWith("/comparativa")) activeTab = "comparativa";

  const handleTabChange = (v: string) => {
    switch (v) {
      case "estadistica": navigate("/estadistica"); break;
      case "datos": navigate("/datos"); break;
      case "timeline": navigate("/timeline"); break;
      case "comparativa": navigate("/comparativa"); break;
      default: navigate("/fichas"); break;
    }
  };

  const matchFicha = location.pathname.match(/^\/fichas\/(.+)/);
  const urlPersonId = matchFicha ? matchFicha[1] : null;

  useEffect(() => {
    if (urlPersonId && urlPersonId !== selectedPersonId) {
      setSelectedPersonId(urlPersonId);
    }
  }, [urlPersonId]); // Sólo cuando cambia la URL para forzar al AppContext

  useEffect(() => {
    // Si cambia el seleccionado internamente y estamos en fichas (o /), actualizamos URL sin romper la historia
    if (selectedPersonId && selectedPersonId !== urlPersonId && activeTab === "fichas") {
      navigate(`/fichas/${selectedPersonId}`, { replace: true });
    }
  }, [selectedPersonId, activeTab]);

  // --- Estado de edición ---
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"person" | "row">("person");
  const [draftPersonId, setDraftPersonId] = useState<string | number | null>(null);
  const [draftRowId, setDraftRowId] = useState<string | number | null>(null);
  const [draft, setDraft] = useState<RawRow | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: string; id: string | number | null }>({ kind: "row", id: null });

  // --- Derivados ---
  const hasFilters = useMemo(
    () =>
      filters.query !== "" ||
      filters.filterReino !== "__all__" ||
      filters.filterDinastia !== "__all__" ||
      filters.filterSiglo !== "__all__",
    [filters]
  );

  const selectedCenturiesText = useMemo(() => {
    if (!selectedCenturies.length) return "";
    return selectedCenturies.map((c) => formatCenturyLabel(c)).join(" · ");
  }, [selectedCenturies]);


  // --- Funciones de edición ---
  function openPersonEditor(personId: string | number) {
    const p = allPeople.find((x) => String(x.personId) === String(personId));
    if (!p) return;
    const base = p.reinados[0] || {};
    const personDraft: RawRow = {
      PersonID: personId,
      "Información verificada": verifiedToText(p.verifiedAll),
      "Nacimiento (Fecha)": base["Nacimiento (Fecha)"] ?? "",
      "Nacimiento (lugar)": base["Nacimiento (lugar)"] ?? "",
      "Nacimiento (ciudad)": base["Nacimiento (ciudad)"] ?? "",
      "Nacimiento (provincia)": base["Nacimiento (provincia)"] ?? "",
      "Nacimiento (País)": base["Nacimiento (País)"] ?? "",
      "Fallecimiento (Fecha)": base["Fallecimiento (Fecha)"] ?? "",
      "Fallecimiento (lugar)": base["Fallecimiento (lugar)"] ?? "",
      "Fallecimiento (ciudad)": base["Fallecimiento (ciudad)"] ?? "",
      "Fallecimiento (provincia)": base["Fallecimiento (provincia)"] ?? "",
      "Fallecimiento (País)": base["Fallecimiento (País)"] ?? "",
      Enterramiento: base["Enterramiento"] ?? "",
      "Imagen URL": base["Imagen URL"] ?? "",
      Galería: base["Galería"] ?? "",
      "Ficha RAH URL": base["Ficha RAH URL"] ?? "",
      Descripción: base["Descripción"] ?? "",
    };
    setEditorMode("person");
    setDraftPersonId(personId);
    setDraftRowId(null);
    setDraft(personDraft);
    setEditorOpen(true);
  }

  function openRowEditor(rowId: string | number) {
    const r = rows.find((x) => String(x._rowId) === String(rowId));
    if (!r) return;
    setEditorMode("row");
    setDraftRowId(rowId);
    setDraftPersonId(getPersonId(r) || null);
    setDraft(JSON.parse(JSON.stringify(r)));
    setEditorOpen(true);
  }

  function commitDraft() {
    if (!draft) return;
    if (editorMode === "person") {
      const err = commitPersonDraft(String(draftPersonId ?? ""), draft);
      if (err) {
        setError(err);
        return;
      }
    } else {
      const err = commitRowDraft(String(draftRowId ?? ""), draft);
      if (err) {
        setError(err);
        return;
      }
    }
    setError(null);
    setEditorOpen(false);
  }

  function addRowForSelectedPerson() {
    if (!selectedPerson) return;
    addRowForPerson(selectedPerson.personId, selectedPerson.reinados[0] || {});
  }

  function removeTarget() {
    if (deleteTarget.kind === "row") {
      removeRow(String(deleteTarget.id ?? ""));
    } else {
      removePerson(String(deleteTarget.id ?? ""));
    }
    setDeleteOpen(false);
  }

  // Helpers de filtros para FichasTab
  const setQuery = (v: string | ((prev: string) => string)) =>
    setFilters((f) => ({ ...f, query: typeof v === 'function' ? v(f.query) : v }));
  const setFilterReino = (v: string | ((prev: string) => string)) =>
    setFilters((f) => ({ ...f, filterReino: typeof v === 'function' ? v(f.filterReino) : v }));
  const setFilterDinastia = (v: string | ((prev: string) => string)) =>
    setFilters((f) => ({ ...f, filterDinastia: typeof v === 'function' ? v(f.filterDinastia) : v }));
  const setFilterSiglo = (v: string | ((prev: string) => string)) =>
    setFilters((f) => ({ ...f, filterSiglo: typeof v === 'function' ? v(f.filterSiglo) : v }));
  const setFilterDinastiaLocked = (v: boolean | ((prev: boolean) => boolean)) =>
    setFilters((f) => ({ ...f, filterDinastiaLocked: typeof v === 'function' ? v(f.filterDinastiaLocked) : v }));
  const setSortKey = (v: string) => setFilters((f) => ({ ...f, sortKey: v }));
  const setSortDir = (v: string) => setFilters((f) => ({ ...f, sortDir: v }));

  // --- Navegación desde estadísticas ---
  const navigateToPerson = (personId: string) => {
    setSelectedPersonId(personId);
    navigate(`/fichas/${personId}`);
  };

  return (
    <div className="min-h-screen w-full dark bg-slate-950 text-slate-50 text-[16px] leading-6">
      <div className="mx-auto max-w-7xl p-4 md:p-8 space-y-6">
        {/* Notificaciones */}
        <div className="fixed right-4 top-4 z-50 space-y-3 w-[min(520px,calc(100vw-2rem))]">
          {showCsvNotice && detectedDelimiter && (
            <Notification
              type="csv"
              message={`delimitador: ${detectedDelimiter} ${detectedQuotes !== null ? (detectedQuotes ? "(con comillas)" : "(sin comillas)") : ""}`}
              onClose={() => setShowCsvNotice(false)}
            />
          )}
          {showChecksNotice && !datasetChecks.ok && (
            <Notification
              type="warn"
              message="incoherencias estructurales"
              list={datasetChecks.issues}
              onClose={() => setShowChecksNotice(false)}
            />
          )}
          {showErrorNotice && error && (
            <Notification
              type="error"
              message={error}
              rawText={rawText}
              onClose={() => setShowErrorNotice(false)}
            />
          )}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                  Gobernantes de España
                </h1>
              </div>
              <p className="text-base text-slate-200">
                La aplicación no consulta fuentes externas. Solo procesa los
                datos que usted cargue.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Button
                  variant="outline"
                  size="icon"
                  className="cursor-pointer bg-slate-950 border-slate-700/70"
                  onClick={() => setShowNoticeCenter((v) => !v)}
                >
                  <Bell className="h-5 w-5 text-slate-100" />
                </Button>
                {showNoticeCenter && (
                  <div className="absolute right-0 mt-2 w-[320px] rounded-[3px] border border-slate-800 bg-slate-950/95 p-3 shadow-xl z-50">
                    <div className="flex items-center justify-between text-sm mb-2 font-semibold">
                      <span>notificaciones</span>
                      <button onClick={() => setShowNoticeCenter(false)}>
                        ×
                      </button>
                    </div>
                    <div className="space-y-2 text-sm">
                      <label className="flex justify-between">
                        <span>csv detectado</span>
                        <input
                          type="checkbox"
                          checked={showCsvNotice}
                          onChange={(e) => setShowCsvNotice(e.target.checked)}
                        />
                      </label>
                      <label className="flex justify-between">
                        <span>advertencias</span>
                        <input
                          type="checkbox"
                          checked={showChecksNotice}
                          onChange={(e) => setShowChecksNotice(e.target.checked)}
                        />
                      </label>
                      <label className="flex justify-between">
                        <span>errores</span>
                        <input
                          type="checkbox"
                          checked={showErrorNotice}
                          onChange={(e) => setShowErrorNotice(e.target.checked)}
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <input
                ref={fileRef}
                type="file"
                accept=".json,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />

              <Button
                variant="secondary"
                onClick={() => fileRef.current?.click()}
                className="rounded-[3px] bg-slate-950/30 border border-slate-700/70"
              >
                <Upload className="h-4 w-4 mr-2" /> cargar datos
              </Button>
              <Button
                variant="outline"
                onClick={exportCsv}
                className="rounded-[3px] bg-slate-950/30 border border-slate-700/70"
              >
                <Download className="h-4 w-4 mr-2" /> CSV
              </Button>
              <Button
                variant="outline"
                onClick={addRowForSelectedPerson}
                disabled={!selectedPerson}
                className="rounded-[3px] bg-slate-950/30 border border-slate-700/70"
              >
                <Plus className="h-4 w-4 mr-2" /> gobierno
              </Button>
            </div>
          </div>
        </motion.div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="rounded-[3px] bg-slate-900/40 border border-slate-800 p-1">
            <TabsTrigger value="fichas" className="rounded-[3px] px-4">
              fichas
            </TabsTrigger>
            <TabsTrigger value="estadistica" className="rounded-[3px] px-4">
              estadística
            </TabsTrigger>
            <TabsTrigger value="timeline" className="rounded-[3px] px-4">
              timeline
            </TabsTrigger>
            <TabsTrigger value="comparativa" className="rounded-[3px] px-4">
              comparativa
            </TabsTrigger>
            <TabsTrigger value="datos" className="rounded-[3px] px-4">
              datos
            </TabsTrigger>
          </TabsList>

          <div className="mt-4">
            <Routes>
              <Route path="/" element={<Navigate to="/fichas" replace />} />
              <Route path="/fichas/*" element={
                <FichasTab
                  people={people}
                  rows={rows}
                  query={filters.query}
                  setQuery={setQuery}
                  filterReino={filters.filterReino}
                  setFilterReino={setFilterReino}
                  filterDinastia={filters.filterDinastia}
                  setFilterDinastia={setFilterDinastia}
                  filterSiglo={filters.filterSiglo}
                  setFilterSiglo={setFilterSiglo}
                  setFilterDinastiaLocked={setFilterDinastiaLocked}
                  sortKey={filters.sortKey}
                  setSortKey={setSortKey}
                  sortDir={filters.sortDir}
                  setSortDir={setSortDir}
                  selectedPersonId={selectedPersonId}
                  setSelectedPersonId={setSelectedPersonId}
                  selectedPerson={selectedPerson}
                  reinos={reinos}
                  dinastias={dinastias}
                  siglos={siglos}
                  selectedCenturies={selectedCenturies}
                  selectedCenturiesText={selectedCenturiesText}
                  openPersonEditor={openPersonEditor}
                  openRowEditor={openRowEditor}
                  setDeleteTarget={setDeleteTarget}
                  setDeleteOpen={setDeleteOpen}
                />
              } />
              
              <Route path="/estadistica" element={
                <StatsTab
                  globalStats={globalStats}
                  filteredStats={filteredStats}
                  hasFilters={hasFilters}
                  onPersonClick={navigateToPerson}
                />
              } />

              <Route path="/datos" element={
                <DataTab
                  rows={rows}
                  datasetName={datasetName}
                  setDatasetName={setDatasetName}
                />
              } />

              <Route path="/timeline" element={<TimelineTab />} />

              <Route path="/comparativa" element={<ComparativaTab />} />
              
              <Route path="*" element={<Navigate to="/fichas" replace />} />
            </Routes>
          </div>
        </Tabs>
      </div>

      <EditorDialog
        open={editorOpen}
        setOpen={setEditorOpen}
        mode={editorMode}
        draft={draft}
        setDraft={setDraft}
        draftPersonId={draftPersonId}
        commitDraft={commitDraft}
        error={error}
        setError={setError}
      />

      <DeleteDialog
        open={deleteOpen}
        setOpen={setDeleteOpen}
        target={deleteTarget}
        removeTarget={removeTarget}
      />
    </div>
  );
}
