
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "./components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";
import {
  Upload,
  Plus,
  ShieldCheck,
  Bell,
  Download,
  UserPlus,
} from "lucide-react";
import { motion } from "framer-motion";

import {
  getPersonId,
  formatCenturyLabel,
  verifiedToText,
} from "./lib/data";
import {
  getPreferredStartupPersonId,
  resolveStartupAwareRouteSelectedPersonId,
} from "./lib/selection";
import type { RawRow } from "./lib/types";
import {
  printResolutionProfileLabel,
  type ImagePrintResolutionProfile,
} from "./lib/print-resolution";

// Componentes
import { Notification } from "./components/ui/notification";
import { StatsTab } from "./components/tabs/stats-tab";
import { FichasTab } from "./components/tabs/fichas-tab";
import { DataTab } from "./components/tabs/data-tab";
import { TimelineTab } from "./components/tabs/timeline-tab";
import { ComparativaTab } from "./components/tabs/comparativa-tab";
import { EditorDialog, DeleteDialog, LoadDataDialog } from "./components/editors/editors";

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
function decodeRouteParam(value: string | null): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function personRoute(personId: string | number): string {
  return `/fichas/${encodeURIComponent(String(personId))}`;
}

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
    addPerson,
    addRowForPerson,
    removeRow,
    removePerson,
    exportDatasetPackage,
    rows,
    mediaAssets,
    mediaPreviewUrls,
    addMediaUrl,
    addUploadedMedia,
    replaceMediaAssetFile,
    replaceMediaAssetUrl,
    moveMediaAsset,
    updateMediaAsset,
    removeMediaAsset,
    setPrimaryMediaAsset,
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
  const urlPersonId = decodeRouteParam(matchFicha ? matchFicha[1] : null);
  const allPersonIds = useMemo(() => allPeople.map((person) => person.personId), [allPeople]);
  const startupPersonId = useMemo(() => getPreferredStartupPersonId(allPeople), [allPeople]);
  const handledRouteDatasetLoadedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!dataset.idbLoaded) return;
    if (activeTab !== "fichas") return;
    if (
      dataset.datasetLoadedAt &&
      startupPersonId &&
      handledRouteDatasetLoadedAtRef.current !== dataset.datasetLoadedAt
    ) {
      handledRouteDatasetLoadedAtRef.current = dataset.datasetLoadedAt;
      if (startupPersonId !== selectedPersonId) {
        setSelectedPersonId(startupPersonId);
      }
      if (startupPersonId !== urlPersonId) {
        navigate(personRoute(startupPersonId), { replace: true });
      }
      return;
    }

    const nextPersonId = !selectedPersonId && startupPersonId
      ? startupPersonId
      : resolveStartupAwareRouteSelectedPersonId(urlPersonId, selectedPersonId, allPersonIds);

    if (!nextPersonId) {
      if (urlPersonId) navigate("/fichas", { replace: true });
      return;
    }

    if (nextPersonId !== selectedPersonId) {
      setSelectedPersonId(nextPersonId);
    }
    if (nextPersonId !== urlPersonId) {
      navigate(personRoute(nextPersonId), { replace: true });
    }
  }, [
    activeTab,
    urlPersonId,
    selectedPersonId,
    allPersonIds,
    startupPersonId,
    setSelectedPersonId,
    navigate,
    dataset.idbLoaded,
    dataset.datasetLoadedAt,
  ]);

  const selectPerson = (personId: string | null) => {
    if (!personId) {
      setSelectedPersonId(null);
      return;
    }

    if (activeTab === "fichas") {
      navigate(personRoute(personId));
      return;
    }

    setSelectedPersonId(personId);
  };

  // --- Estado de edición ---
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"person" | "row">("person");
  const [draftPersonId, setDraftPersonId] = useState<string | number | null>(null);
  const [draftRowId, setDraftRowId] = useState<string | number | null>(null);
  const [draft, setDraft] = useState<RawRow | null>(null);
  const [draftPersonRows, setDraftPersonRows] = useState<RawRow[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: string; id: string | number | null }>({ kind: "row", id: null });

  // --- Carga de datos (con confirmación) ---
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [loadConfirmOpen, setLoadConfirmOpen] = useState(false);
  const [imagePrintProfile, setImagePrintProfile] = useState<ImagePrintResolutionProfile>("original");
  const uploadedMediaCount = useMemo(
    () => mediaAssets.filter((asset) => asset.kind === "uploaded-file").length,
    [mediaAssets]
  );

  function requestLoadFile(file: File) {
    setPendingFile(file);
    setLoadConfirmOpen(true);
  }

  function confirmLoadFile() {
    if (pendingFile) handleFile(pendingFile);
    setLoadConfirmOpen(false);
    setPendingFile(null);
  }

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
      "Nombre principal": p.nombrePrincipal === "(sin nombre)" ? "" : p.nombrePrincipal,
      Apelativo: p.apelativos?.[0] ?? base.Apelativo ?? base.apelativo ?? "",
      Dinastía: p.hasDinastiaConflict ? "" : p.dinastia,
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
      "Ficha RAH URL": base["Ficha RAH URL"] ?? "",
      Descripción: base["Descripción"] ?? "",
    };
    setEditorMode("person");
    setDraftPersonId(personId);
    setDraftRowId(null);
    setDraft(personDraft);
    setDraftPersonRows(p.reinados.map((row) => ({ ...row })));
    setEditorOpen(true);
  }

  function openRowEditor(rowId: string | number) {
    const r = rows.find((x) => String(x._rowId) === String(rowId));
    if (!r) return;
    setEditorMode("row");
    setDraftRowId(rowId);
    setDraftPersonId(getPersonId(r) || null);
    setDraftPersonRows([]);
    setDraft(JSON.parse(JSON.stringify(r)));
    setEditorOpen(true);
  }

  function commitDraft(
    { closeAfterSave = true }: { closeAfterSave?: boolean } = {}
  ): boolean {
    if (!draft) return false;
    if (editorMode === "person") {
      const err = commitPersonDraft(String(draftPersonId ?? ""), draft, draftPersonRows);
      if (err) {
        setError(err);
        return false;
      }
    } else {
      const err = commitRowDraft(String(draftRowId ?? ""), draft);
      if (err) {
        setError(err);
        return false;
      }
    }
    setError(null);
    if (closeAfterSave) setEditorOpen(false);
    return true;
  }

  function addRowForSelectedPerson() {
    if (!selectedPerson) return;
    addRowForPerson(selectedPerson.personId, selectedPerson.reinados[0] || {});
  }

  function createNewPerson() {
    const { personId: newId, row: newRow } = addPerson();
    selectPerson(String(newId));
    setEditorMode("person");
    setDraftPersonId(newId);
    setDraftRowId(null);
    setDraft({
      PersonID: newId,
      "Nombre principal": "",
      Apelativo: "",
      Dinastía: "",
      "Información verificada": verifiedToText(false),
      "Nacimiento (Fecha)": "",
      "Nacimiento (lugar)": "",
      "Nacimiento (ciudad)": "",
      "Nacimiento (provincia)": "",
      "Nacimiento (País)": "",
      "Fallecimiento (Fecha)": "",
      "Fallecimiento (lugar)": "",
      "Fallecimiento (ciudad)": "",
      "Fallecimiento (provincia)": "",
      "Fallecimiento (País)": "",
      Enterramiento: "",
      "Ficha RAH URL": "",
      Descripción: "",
    });
    setDraftPersonRows([{ ...newRow }]);
    setEditorOpen(true);
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
    navigate(personRoute(personId));
  };

  return (
    <div className="min-h-screen w-full overflow-x-clip dark bg-slate-950 text-slate-50 text-[16px] leading-6">
      <div className="mx-auto w-full max-w-[1920px] space-y-6 px-3 py-4 sm:px-5 lg:px-8 2xl:px-10">
        {/* Notificaciones */}
        <div className="fixed left-3 right-3 top-3 z-50 space-y-3 sm:left-auto sm:right-4 sm:w-[min(520px,calc(100vw-2rem))]">
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
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-5xl">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 shrink-0" />
                <h1 className="text-2xl font-medium tracking-tight sm:text-3xl xl:text-4xl">
                  Gobernantes de España
                </h1>
              </div>
            </div>
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
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
                    <div className="flex items-center justify-between text-sm mb-2 font-medium">
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
                accept=".json,.csv,.zip"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) requestLoadFile(f);
                  e.target.value = "";
                }}
              />

              <Button
                variant="secondary"
                onClick={() => fileRef.current?.click()}
                title="Importa un archivo .csv, .json o .zip. Reemplaza por completo los datos actuales (te pedimos confirmación antes)."
                className="w-full rounded-[3px] bg-slate-950/30 border border-slate-700/70 sm:w-auto"
              >
                <Upload className="h-4 w-4 mr-2" /> Cargar datos
              </Button>
              <Button
                variant="outline"
                onClick={() => exportDatasetPackage(imagePrintProfile)}
                title={`Descarga un ZIP con TODO. Perfil de imágenes: ${printResolutionProfileLabel(imagePrintProfile)}.`}
                className="w-full rounded-[3px] bg-slate-950/30 border border-slate-700/70 sm:w-auto"
              >
                <Download className="h-4 w-4 mr-2" /> Guardar todo
              </Button>
              <Button
                variant="outline"
                onClick={createNewPerson}
                title="Crear un rey/personaje nuevo desde cero"
                className="w-full rounded-[3px] bg-slate-950/30 border border-slate-700/70 sm:w-auto"
              >
                <UserPlus className="h-4 w-4 mr-2" /> Nuevo rey
              </Button>
              <Button
                variant="outline"
                onClick={addRowForSelectedPerson}
                disabled={!selectedPerson}
                title="Añadir un gobierno/reino al rey seleccionado"
                className="w-full rounded-[3px] bg-slate-950/30 border border-slate-700/70 sm:w-auto"
              >
                <Plus className="h-4 w-4 mr-2" /> Gobierno
              </Button>
            </div>
          </div>
        </motion.div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-[3px] bg-slate-900/40 border border-slate-800 p-1">
            <TabsTrigger value="fichas" className="min-w-[calc(50%-0.25rem)] flex-1 rounded-[3px] px-3 sm:min-w-0 sm:flex-none sm:px-4">
              Fichas
            </TabsTrigger>
            <TabsTrigger value="estadistica" className="min-w-[calc(50%-0.25rem)] flex-1 rounded-[3px] px-3 sm:min-w-0 sm:flex-none sm:px-4">
              Estadística
            </TabsTrigger>
            <TabsTrigger value="timeline" className="min-w-[calc(50%-0.25rem)] flex-1 rounded-[3px] px-3 sm:min-w-0 sm:flex-none sm:px-4">
              Línea temporal
            </TabsTrigger>
            <TabsTrigger value="comparativa" className="min-w-[calc(50%-0.25rem)] flex-1 rounded-[3px] px-3 sm:min-w-0 sm:flex-none sm:px-4">
              Comparativa
            </TabsTrigger>
            <TabsTrigger value="datos" className="min-w-[calc(50%-0.25rem)] flex-1 rounded-[3px] px-3 sm:min-w-0 sm:flex-none sm:px-4">
              Datos
            </TabsTrigger>
          </TabsList>

          <div className="mt-3 min-w-0">
            <Routes>
              <Route path="/" element={<Navigate to="/fichas" replace />} />
              <Route path="/fichas/*" element={
                <FichasTab
                  people={people}
                  chronologicalPeople={allPeople}
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
                  setSelectedPersonId={selectPerson}
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
                  mediaAssets={mediaAssets}
                  mediaPreviewUrls={mediaPreviewUrls}
                  addMediaUrl={addMediaUrl}
                  addUploadedMedia={addUploadedMedia}
                  replaceMediaAssetFile={replaceMediaAssetFile}
                  replaceMediaAssetUrl={replaceMediaAssetUrl}
                  moveMediaAsset={moveMediaAsset}
                  updateMediaAsset={updateMediaAsset}
                  removeMediaAsset={removeMediaAsset}
                  setPrimaryMediaAsset={setPrimaryMediaAsset}
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
                  mediaAssets={mediaAssets}
                  imagePrintProfile={imagePrintProfile}
                  setImagePrintProfile={setImagePrintProfile}
                  exportDatasetPackage={exportDatasetPackage}
                />
              } />

              <Route path="/timeline" element={<TimelineTab />} />

              <Route path="/comparativa" element={<ComparativaTab mediaAssets={mediaAssets} mediaPreviewUrls={mediaPreviewUrls} />} />
              
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
        draftPersonRows={draftPersonRows}
        setDraftPersonRows={setDraftPersonRows}
        draftPersonId={draftPersonId}
        draftRowId={draftRowId}
        commitDraft={commitDraft}
        setError={setError}
        people={allPeople}
      />

      <DeleteDialog
        open={deleteOpen}
        setOpen={setDeleteOpen}
        target={deleteTarget}
        removeTarget={removeTarget}
      />

      <LoadDataDialog
        open={loadConfirmOpen}
        setOpen={setLoadConfirmOpen}
        file={pendingFile}
        uploadedCount={uploadedMediaCount}
        onConfirm={confirmLoadFile}
      />
    </div>
  );
}
