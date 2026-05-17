import {
  getPersonMediaAssets,
  getPrimaryMediaAsset,
} from "../../lib/media";
import { getAdjacentPersonIds } from "../../lib/selection";
import { PersonDetailCard } from "./fichas/person-detail-card";
import { PersonListPanel } from "./fichas/person-list-panel";
import type { MediaAsset, MediaInputOptions, Person, RawRow } from "../../lib/types";

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
  updateMediaAsset,
  removeMediaAsset,
  setPrimaryMediaAsset,
}: FichasTabProps) {
  const selectedMediaAssets = selectedPerson ? getPersonMediaAssets(mediaAssets, selectedPerson.personId) : [];
  const selectedPrimaryMediaAsset = selectedPerson ? getPrimaryMediaAsset(selectedMediaAssets, selectedPerson.personId) : null;
  const selectedNeighbors = getAdjacentPersonIds(chronologicalPeople, selectedPerson?.personId);
  const predecessor = selectedNeighbors.predecessorId
    ? chronologicalPeople.find((person) => String(person.personId) === selectedNeighbors.predecessorId) ?? null
    : null;
  const successor = selectedNeighbors.successorId
    ? chronologicalPeople.find((person) => String(person.personId) === selectedNeighbors.successorId) ?? null
    : null;

  return (
    <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(330px,420px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(380px,460px)_minmax(0,1fr)]">
      <PersonListPanel
        people={people}
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
        setSelectedPersonId={setSelectedPersonId}
        reinos={reinos}
        dinastias={dinastias}
        siglos={siglos}
        mediaAssets={mediaAssets}
        mediaPreviewUrls={mediaPreviewUrls}
      />

      <PersonDetailCard
        selectedPerson={selectedPerson}
        predecessor={predecessor}
        successor={successor}
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
        setSelectedPersonId={setSelectedPersonId}
        openPersonEditor={openPersonEditor}
        openRowEditor={openRowEditor}
        setDeleteTarget={setDeleteTarget}
        setDeleteOpen={setDeleteOpen}
        addMediaUrl={addMediaUrl}
        addUploadedMedia={addUploadedMedia}
        updateMediaAsset={updateMediaAsset}
        removeMediaAsset={removeMediaAsset}
        setPrimaryMediaAsset={setPrimaryMediaAsset}
      />
    </div>
  );
}
