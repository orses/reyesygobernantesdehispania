import { useMemo, useState } from "react";
import { PanelLeftOpen } from "lucide-react";
import {
  getPersonMediaAssets,
  getPrimaryMediaAsset,
} from "../../lib/media";
import { getFirstMatchingPersonId } from "../../lib/people";
import { buildGovernmentSuccession } from "../../lib/succession";
import { PersonDetailCard } from "./fichas/person-detail-card";
import { PersonListPanel } from "./fichas/person-list-panel";
import { Button } from "../ui/button";
import type { MediaAsset, MediaAssetMoveDirection, MediaInputOptions, Person, RawRow } from "../../lib/types";

type StateSetter<T> = (value: T | ((prev: T) => T)) => void;

interface FichasTabProps {
  people: Person[];
  chronologicalPeople: Person[];
  rows: RawRow[];
  query: string;
  setQuery: StateSetter<string>;
  filterReino: string;
  setFilterReino: StateSetter<string>;
  filterDinastia: string;
  setFilterDinastia: StateSetter<string>;
  filterSiglo: string;
  setFilterSiglo: StateSetter<string>;
  setFilterDinastiaLocked: StateSetter<boolean>;
  sortKey: string;
  setSortKey: (value: string) => void;
  sortDir: string;
  setSortDir: (value: string) => void;
  selectedPersonId: string | null;
  setSelectedPersonId: (value: string | null) => void;
  selectedPerson: Person | null;
  reinos: string[];
  dinastias: string[];
  siglos: string[];
  selectedCenturies: number[];
  selectedCenturiesText: string;
  openPersonEditor: (personId: string | number) => void;
  openRowEditor: (rowId: string | number) => void;
  setDeleteTarget: (target: { kind: string; id: string | number | null }) => void;
  setDeleteOpen: (value: boolean) => void;
  mediaAssets?: MediaAsset[];
  mediaPreviewUrls?: Record<string, string>;
  addMediaUrl?: (personId: string | number, url: string, options?: MediaInputOptions) => string | null;
  addUploadedMedia?: (personId: string | number, file: File, options?: MediaInputOptions) => Promise<string | null>;
  replaceMediaAssetFile?: (assetId: string, file: File) => Promise<boolean>;
  replaceMediaAssetUrl?: (assetId: string, url: string) => Promise<boolean>;
  moveMediaAsset?: (personId: string | number, assetId: string, direction: MediaAssetMoveDirection) => void;
  updateMediaAsset?: (assetId: string, patch: Partial<MediaAsset>) => void;
  removeMediaAsset?: (assetId: string) => Promise<void>;
  setPrimaryMediaAsset?: (personId: string | number, assetId: string) => void;
}

const SORT_OPTIONS: Record<string, string> = {
  "cronologia:asc": "cronología: más antiguos a más recientes",
  "cronologia:desc": "cronología: más recientes a más antiguos",
  "nombre:asc": "nombre: A-Z",
  "nombre:desc": "nombre: Z-A",
  "dinastia:asc": "dinastía: A-Z",
  "dinastia:desc": "dinastía: Z-A",
  "reinos:asc": "reinos: A-Z",
  "reinos:desc": "reinos: Z-A",
  "duracion:desc": "duración: mayor a menor",
  "duracion:asc": "duración: menor a mayor",
  "edad:desc": "edad: mayor a menor",
  "edad:asc": "edad: menor a mayor",
};

function rowIdForDetail(row: RawRow, fallbackIndex: number): string {
  return String(row?._rowId ?? row?.ID ?? `period-${fallbackIndex + 1}`);
}

export function FichasTab({
  people,
  chronologicalPeople,
  rows,
  query,
  setQuery,
  filterReino,
  setFilterReino,
  filterDinastia,
  setFilterDinastia,
  filterSiglo,
  setFilterSiglo,
  setFilterDinastiaLocked,
  sortKey,
  setSortKey,
  sortDir,
  setSortDir,
  selectedPersonId,
  setSelectedPersonId,
  selectedPerson,
  reinos,
  dinastias,
  siglos,
  selectedCenturies,
  selectedCenturiesText,
  openPersonEditor,
  openRowEditor,
  setDeleteTarget,
  setDeleteOpen,
  mediaAssets = [],
  mediaPreviewUrls = {},
  addMediaUrl,
  addUploadedMedia,
  replaceMediaAssetFile,
  replaceMediaAssetUrl,
  moveMediaAsset,
  updateMediaAsset,
  removeMediaAsset,
  setPrimaryMediaAsset,
}: FichasTabProps) {
  const [selectedGovernmentRowId, setSelectedGovernmentRowId] = useState<string | null>(null);
  const [isListPanelCollapsed, setIsListPanelCollapsed] = useState(false);
  const selectedMediaAssets = selectedPerson ? getPersonMediaAssets(mediaAssets, selectedPerson.personId) : [];
  const selectedPrimaryMediaAsset = selectedPerson ? getPrimaryMediaAsset(selectedMediaAssets, selectedPerson.personId) : null;
  const hasQuery = query.trim().length > 0;
  const hasReinoFilter = filterReino !== "__all__";
  const hasDinastiaFilter = filterDinastia !== "__all__";
  const hasSigloFilter = filterSiglo !== "__all__";
  const hasSortFilter = sortKey !== "cronologia" || sortDir !== "asc";
  const activeFilterCount =
    (hasQuery ? 1 : 0) +
    (hasReinoFilter ? 1 : 0) +
    (hasDinastiaFilter ? 1 : 0) +
    (hasSigloFilter ? 1 : 0) +
    (hasSortFilter ? 1 : 0);
  const collapsedPanelFilterLabel =
    activeFilterCount === 0
      ? "sin filtros activos"
      : `${activeFilterCount} ${activeFilterCount === 1 ? "filtro activo" : "filtros activos"}`;
  const selectedGovernmentRow = useMemo(
    () =>
      selectedPerson?.reinados.find(
        (row, index) => rowIdForDetail(row, index) === selectedGovernmentRowId
      ) ?? null,
    [selectedGovernmentRowId, selectedPerson]
  );
  const governmentSuccession = useMemo(
    () => buildGovernmentSuccession(chronologicalPeople),
    [chronologicalPeople]
  );
  const selectPerson = (personId: string | null) => {
    setSelectedGovernmentRowId(null);
    setSelectedPersonId(personId);
  };
  const selectGovernment = (personId: string, rowId: string) => {
    setSelectedGovernmentRowId(rowId);
    setSelectedPersonId(personId);
  };
  const selectFirstSearchMatch = (searchText: string) => {
    const firstPersonId = getFirstMatchingPersonId(people, searchText);
    if (firstPersonId) selectPerson(firstPersonId);
  };

  return (
    <div
      className={`grid grid-cols-1 items-start gap-4 ${
        isListPanelCollapsed
          ? "xl:grid-cols-1"
          : "xl:grid-cols-[minmax(330px,420px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(380px,460px)_minmax(0,1fr)]"
      }`}
    >
      {isListPanelCollapsed ? (
        <div className="rounded-[3px] border border-slate-800 bg-slate-900/30 p-3 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-100">Filtros y miniaturas ocultos</div>
              <div className="mt-1 text-sm text-slate-300">
                {people.length} de {chronologicalPeople.length} personajes; {collapsedPanelFilterLabel}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-9 shrink-0 rounded-[3px] border-slate-700/70 bg-slate-950/30 text-slate-100 hover:bg-slate-900/70 hover:text-slate-50"
              title="Mostrar filtros y miniaturas"
              aria-label="Mostrar filtros y miniaturas"
              onClick={() => setIsListPanelCollapsed(false)}
            >
              <PanelLeftOpen className="mr-2 h-4 w-4" />
              mostrar panel
            </Button>
          </div>
        </div>
      ) : (
        <PersonListPanel
          people={people}
          totalPeopleCount={chronologicalPeople.length}
          rowsCount={rows.length}
          query={query}
          setQuery={setQuery}
          filterReino={filterReino}
          setFilterReino={setFilterReino}
          filterDinastia={filterDinastia}
          setFilterDinastia={setFilterDinastia}
          filterSiglo={filterSiglo}
          setFilterSiglo={setFilterSiglo}
          setFilterDinastiaLocked={setFilterDinastiaLocked}
          sortKey={sortKey}
          setSortKey={setSortKey}
          sortDir={sortDir}
          setSortDir={setSortDir}
          sortOptions={SORT_OPTIONS}
          selectedPersonId={selectedPersonId}
          selectedGovernmentRowId={selectedGovernmentRowId}
          setSelectedGovernment={selectGovernment}
          onSearchSubmit={selectFirstSearchMatch}
          reinos={reinos}
          dinastias={dinastias}
          siglos={siglos}
          mediaAssets={mediaAssets}
          mediaPreviewUrls={mediaPreviewUrls}
          onCollapse={() => setIsListPanelCollapsed(true)}
        />
      )}

      <PersonDetailCard
        selectedPerson={selectedPerson}
        selectedGovernmentRow={selectedGovernmentRow}
        successionByRowId={governmentSuccession}
        selectedPrimaryMediaAsset={selectedPrimaryMediaAsset}
        selectedMediaAssets={selectedMediaAssets}
        mediaPreviewUrls={mediaPreviewUrls}
        selectedCenturies={selectedCenturies}
        selectedCenturiesText={selectedCenturiesText}
        filterReino={filterReino}
        setFilterReino={setFilterReino}
        filterDinastia={filterDinastia}
        setFilterDinastia={setFilterDinastia}
        setFilterDinastiaLocked={setFilterDinastiaLocked}
        filterSiglo={filterSiglo}
        setFilterSiglo={setFilterSiglo}
        setSelectedPersonId={selectPerson}
        openPersonEditor={openPersonEditor}
        openRowEditor={openRowEditor}
        setDeleteTarget={setDeleteTarget}
        setDeleteOpen={setDeleteOpen}
        addMediaUrl={addMediaUrl}
        addUploadedMedia={addUploadedMedia}
        replaceMediaAssetFile={replaceMediaAssetFile}
        replaceMediaAssetUrl={replaceMediaAssetUrl}
        moveMediaAsset={moveMediaAsset}
        updateMediaAsset={updateMediaAsset}
        removeMediaAsset={removeMediaAsset}
        setPrimaryMediaAsset={setPrimaryMediaAsset}
      />
    </div>
  );
}
