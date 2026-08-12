
import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "./components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import {
  Upload,
  Plus,
  ShieldCheck,
  Bell,
  Download,
  UserPlus,
} from "lucide-react";
import {
  formatCenturyLabel,
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
import {
  hasBlockingModal,
  isOpenPersonEditorShortcut,
} from "./lib/person-editor-keyboard-shortcut";
import { useHashLocation } from "./lib/hash-router";
import { hasActiveDatasetFilters } from "./lib/filters";
import { isPendingDatasetReplacement } from "./lib/dataset-revision";
import {
  completeEditorSave,
  createClosedEditorSession,
  editorSessionReducer,
} from "./lib/editor-session";

// Componentes
import { Notification } from "./components/ui/notification";
import { FichasTab } from "./components/tabs/fichas-tab";
import { DatasetHydrationGate } from "./components/dataset-hydration-gate";

const StatsTab = lazy(() =>
  import("./components/tabs/stats-tab").then((module) => ({ default: module.StatsTab }))
);
const DataTab = lazy(() =>
  import("./components/tabs/data-tab").then((module) => ({ default: module.DataTab }))
);
const TimelineTab = lazy(() =>
  import("./components/tabs/timeline-tab").then((module) => ({ default: module.TimelineTab }))
);
const ComparativaTab = lazy(() =>
  import("./components/tabs/comparativa-tab").then((module) => ({ default: module.ComparativaTab }))
);
const EditorDialog = lazy(() =>
  import("./components/editors/editors").then((module) => ({ default: module.EditorDialog }))
);
const DeleteDialog = lazy(() =>
  import("./components/editors/editors").then((module) => ({ default: module.DeleteDialog }))
);
const LoadDataDialog = lazy(() =>
  import("./components/editors/editors").then((module) => ({ default: module.LoadDataDialog }))
);
const ImportReviewDialog = lazy(() =>
  import("./components/import-review-dialog").then((module) => ({
    default: module.ImportReviewDialog,
  }))
);

// Estado de datos y contexto de la aplicación.
import { useDataset } from "./hooks/useDataset";
import { AppProvider, useAppContext } from "./context/AppContext";

// ---------------------------------------------------------------------------
// Componente raíz: inyecta AppProvider
// ---------------------------------------------------------------------------
export default function ReyesApp() {
  const dataset = useDataset();

  if (dataset.hydrationStatus !== "ready") {
    return (
      <DatasetHydrationGate
        status={dataset.hydrationStatus}
        errorMessage={dataset.error}
        onRetry={() => globalThis.location.reload()}
      />
    );
  }

  return (
    <AppProvider
      rows={dataset.rows}
      idbLoaded={dataset.idbLoaded}
      datasetReplacementRevision={dataset.datasetReplacementRevision}
    >
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

const EMPTY_EDITOR_ROWS: RawRow[] = [];

function LoadingPanel() {
  return (
    <div
      className="rounded-[3px] border border-slate-800 bg-slate-900/30 px-4 py-8 text-center text-sm text-slate-300"
      role="status"
      aria-live="polite"
    >
      Cargando módulo…
    </div>
  );
}

function ReyesAppInner({ dataset }: { dataset: ReturnType<typeof useDataset> }) {
  const {
    fileRef,
    rawText,
    detectedDelimiter,
    detectedQuotes,
    error,
    setError,
    pendingDatasetImportReview,
    isApplyingDatasetImportReview,
    applyDatasetImportRepairs,
    cancelDatasetImportReview,
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
    tipos,
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
  const noticeCenterButtonRef = useRef<HTMLButtonElement>(null);

  // --- Rutas y sincronización ---
  const { pathname, navigate } = useHashLocation();

  let activeTab = "fichas";
  if (pathname.startsWith("/estadistica")) activeTab = "estadistica";
  else if (pathname.startsWith("/datos")) activeTab = "datos";
  else if (pathname.startsWith("/timeline")) activeTab = "timeline";
  else if (pathname.startsWith("/comparativa")) activeTab = "comparativa";

  const handleTabChange = (v: string) => {
    switch (v) {
      case "estadistica": navigate("/estadistica"); break;
      case "datos": navigate("/datos"); break;
      case "timeline": navigate("/timeline"); break;
      case "comparativa": navigate("/comparativa"); break;
      default: navigate("/fichas"); break;
    }
  };

  const matchFicha = pathname.match(/^\/fichas\/(.+)/);
  const urlPersonId = decodeRouteParam(matchFicha ? matchFicha[1] : null);
  const visiblePersonIds = useMemo(() => people.map((person) => person.personId), [people]);
  const startupPersonId = useMemo(() => getPreferredStartupPersonId(allPeople), [allPeople]);
  const handledRouteDatasetReplacementRevisionRef = useRef(0);

  useEffect(() => {
    if (!dataset.idbLoaded) return;
    if (activeTab !== "fichas") return;
    if (
      isPendingDatasetReplacement(
        dataset.datasetReplacementRevision,
        handledRouteDatasetReplacementRevisionRef.current
      )
    ) {
      handledRouteDatasetReplacementRevisionRef.current = dataset.datasetReplacementRevision;
      if (!startupPersonId) {
        if (urlPersonId) navigate("/fichas", { replace: true });
      } else if (startupPersonId !== urlPersonId) {
        navigate(personRoute(startupPersonId), { replace: true });
      }
      return;
    }

    const nextPersonId = resolveStartupAwareRouteSelectedPersonId(
      urlPersonId,
      selectedPersonId,
      visiblePersonIds
    );

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
    visiblePersonIds,
    startupPersonId,
    setSelectedPersonId,
    navigate,
    dataset.idbLoaded,
    dataset.datasetReplacementRevision,
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
  const [editorSession, dispatchEditorSession] = React.useReducer(
    editorSessionReducer,
    createClosedEditorSession()
  );
  const editorOpen = editorSession.kind !== "closed";
  const editorMode = editorSession.kind === "row" ? "row" : "person";
  const draft = editorSession.kind === "closed" ? null : editorSession.draft;
  const draftPersonRows = editorSession.kind === "person"
    ? editorSession.governmentRows
    : EMPTY_EDITOR_ROWS;
  const draftPersonId = editorSession.kind === "closed"
    ? null
    : editorSession.personId;
  const draftRowId = editorSession.kind === "row" ? editorSession.rowId : null;
  const setEditorOpen = React.useCallback((open: boolean) => {
    if (!open) dispatchEditorSession({ type: "close" });
  }, []);
  const setDraft = React.useCallback<React.Dispatch<React.SetStateAction<RawRow | null>>>(
    (value) => dispatchEditorSession({ type: "set-draft", value }),
    []
  );
  const setDraftPersonRows = React.useCallback<React.Dispatch<React.SetStateAction<RawRow[]>>>(
    (value) => dispatchEditorSession({ type: "set-government-rows", value }),
    []
  );
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
  const hasFilters = useMemo(() => hasActiveDatasetFilters(filters), [filters]);

  const selectedCenturiesText = useMemo(() => {
    if (!selectedCenturies.length) return "";
    return selectedCenturies.map((c) => formatCenturyLabel(c)).join(" · ");
  }, [selectedCenturies]);


  // --- Funciones de edición ---
  const openPersonEditor = React.useCallback((personId: string | number) => {
    const p = allPeople.find((x) => String(x.personId) === String(personId));
    if (!p) return;
    dispatchEditorSession({ type: "open-person", person: p });
  }, [allPeople]);

  useEffect(() => {
    const canOpenPersonEditor =
      activeTab === "fichas" &&
      selectedPerson !== null &&
      !editorOpen &&
      !deleteOpen &&
      !loadConfirmOpen;

    if (!canOpenPersonEditor) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpenPersonEditorShortcut(event)) return;
      event.preventDefault();
      if (hasBlockingModal(document)) return;

      openPersonEditor(selectedPerson.personId);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    activeTab,
    deleteOpen,
    editorOpen,
    loadConfirmOpen,
    openPersonEditor,
    selectedPerson,
  ]);

  function openRowEditor(rowId: string | number) {
    const r = rows.find((x) => String(x._rowId) === String(rowId));
    if (!r) return;
    dispatchEditorSession({ type: "open-row", row: r, rowId });
  }

  async function commitDraft(
    { closeAfterSave = true }: { closeAfterSave?: boolean } = {}
  ): Promise<boolean> {
    if (!draft) return false;

    const commit = editorMode === "person"
      ? () => commitPersonDraft(String(draftPersonId ?? ""), draft, draftPersonRows)
      : () => commitRowDraft(String(draftRowId ?? ""), draft);

    return completeEditorSave({
      commit,
      closeAfterSave,
      setError,
      close: () => setEditorOpen(false),
    });
  }

  function addRowForSelectedPerson() {
    if (!selectedPerson) return;
    addRowForPerson(selectedPerson.personId, selectedPerson.reinados[0] || {});
  }

  function createNewPerson() {
    const { personId: newId, row: newRow } = addPerson();
    selectPerson(String(newId));
    dispatchEditorSession({
      type: "open-new-person",
      personId: newId,
      row: newRow,
    });
  }

  function removeTarget() {
    if (deleteTarget.kind === "row") {
      removeRow(String(deleteTarget.id ?? ""));
    } else {
      removePerson(String(deleteTarget.id ?? ""));
    }
    setDeleteOpen(false);
  }

  // Funciones auxiliares de filtros para FichasTab.
  const setQuery = (v: string | ((prev: string) => string)) =>
    setFilters((f) => ({ ...f, query: typeof v === 'function' ? v(f.query) : v }));
  const setLiteralSearch = (v: boolean | ((prev: boolean) => boolean)) =>
    setFilters((f) => ({ ...f, literalSearch: typeof v === 'function' ? v(f.literalSearch) : v }));
  const setFilterReino = (v: string | ((prev: string) => string)) =>
    setFilters((f) => ({ ...f, filterReino: typeof v === 'function' ? v(f.filterReino) : v }));
  const setFilterTipo = (v: string | ((prev: string) => string)) =>
    setFilters((f) => ({ ...f, filterTipo: typeof v === 'function' ? v(f.filterTipo) : v }));
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

        <div className="app-header-enter">
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
                  ref={noticeCenterButtonRef}
                  type="button"
                  variant="outline"
                  size="icon"
                  className="cursor-pointer bg-slate-950 border-slate-700/70"
                  onClick={() => setShowNoticeCenter((v) => !v)}
                  aria-label={showNoticeCenter ? "Cerrar preferencias de notificaciones" : "Abrir preferencias de notificaciones"}
                  aria-expanded={showNoticeCenter}
                  aria-controls="notification-preferences"
                >
                  <Bell className="h-5 w-5 text-slate-100" aria-hidden="true" />
                </Button>
                {showNoticeCenter && (
                  <div
                    id="notification-preferences"
                    role="region"
                    aria-label="Preferencias de notificaciones"
                    className="absolute right-0 mt-2 w-[320px] rounded-[3px] border border-slate-800 bg-slate-950/95 p-3 shadow-xl z-50"
                    onKeyDown={(event) => {
                      if (event.key !== "Escape") return;
                      event.preventDefault();
                      setShowNoticeCenter(false);
                      noticeCenterButtonRef.current?.focus();
                    }}
                  >
                    <div className="flex items-center justify-between text-sm mb-2 font-medium">
                      <span>notificaciones</span>
                      <button
                        type="button"
                        aria-label="Cerrar preferencias de notificaciones"
                        title="Cerrar preferencias de notificaciones"
                        className="rounded-[3px] px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                        onClick={() => {
                          setShowNoticeCenter(false);
                          noticeCenterButtonRef.current?.focus();
                        }}
                      >
                        <span aria-hidden="true">×</span>
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
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList
            aria-label="Secciones principales"
            className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-[3px] bg-slate-900/40 border border-slate-800 p-1"
          >
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
            <Suspense fallback={<LoadingPanel />}>
              <TabsContent value="fichas" className="mt-0">
                <FichasTab
                  people={people}
                  chronologicalPeople={allPeople}
                  rows={rows}
                  query={filters.query}
                  setQuery={setQuery}
                  literalSearch={filters.literalSearch}
                  setLiteralSearch={setLiteralSearch}
                  filterReino={filters.filterReino}
                  setFilterReino={setFilterReino}
                  filterTipo={filters.filterTipo}
                  setFilterTipo={setFilterTipo}
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
                  tipos={tipos}
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
              </TabsContent>
              
              <TabsContent value="estadistica" className="mt-0">
                <StatsTab
                  globalStats={globalStats}
                  filteredStats={filteredStats}
                  hasFilters={hasFilters}
                  onPersonClick={navigateToPerson}
                  onTabChange={handleTabChange}
                />
              </TabsContent>

              <TabsContent value="datos" className="mt-0">
                <DataTab
                  rows={rows}
                  datasetName={datasetName}
                  setDatasetName={setDatasetName}
                  mediaAssets={mediaAssets}
                  imagePrintProfile={imagePrintProfile}
                  setImagePrintProfile={setImagePrintProfile}
                  exportDatasetPackage={exportDatasetPackage}
                />
              </TabsContent>

              <TabsContent value="timeline" className="mt-0">
                <TimelineTab />
              </TabsContent>

              <TabsContent value="comparativa" className="mt-0">
                <ComparativaTab mediaAssets={mediaAssets} mediaPreviewUrls={mediaPreviewUrls} />
              </TabsContent>
            </Suspense>
          </div>
        </Tabs>
      </div>

      <Suspense fallback={null}>
        {editorOpen && (
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
        )}

        {deleteOpen && (
          <DeleteDialog
            open={deleteOpen}
            setOpen={setDeleteOpen}
            target={deleteTarget}
            removeTarget={removeTarget}
          />
        )}

        {loadConfirmOpen && (
          <LoadDataDialog
            open={loadConfirmOpen}
            setOpen={setLoadConfirmOpen}
            file={pendingFile}
            uploadedCount={uploadedMediaCount}
            onConfirm={confirmLoadFile}
          />
        )}

        {pendingDatasetImportReview && (
          <ImportReviewDialog
            open
            fileName={pendingDatasetImportReview.file.name}
            review={pendingDatasetImportReview.review}
            resolutionError={pendingDatasetImportReview.resolutionError}
            isApplying={isApplyingDatasetImportReview}
            onApply={applyDatasetImportRepairs}
            onCancel={cancelDatasetImportReview}
          />
        )}
      </Suspense>
    </div>
  );
}
