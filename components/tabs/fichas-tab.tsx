import { useMemo } from "react";
import {
  getPersonMediaAssets,
  getPrimaryMediaAsset,
} from "../../lib/media";
import { getFirstMatchingPersonId } from "../../lib/people";
import { buildGovernmentSuccession } from "../../lib/succession";
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
  replaceMediaAssetFile?: (assetId: string, file: File) => Promise<boolean>;
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
  replaceMediaAssetFile,
  updateMediaAsset,
  removeMediaAsset,
  setPrimaryMediaAsset,
}: FichasTabProps) {
  const selectedMediaAssets = selectedPerson ? getPersonMediaAssets(mediaAssets, selectedPerson.personId) : [];
  const selectedPrimaryMediaAsset = selectedPerson ? getPrimaryMediaAsset(selectedMediaAssets, selectedPerson.personId) : null;
  const governmentSuccession = useMemo(
    () => buildGovernmentSuccession(chronologicalPeople),
    [chronologicalPeople]
  );
  const selectFirstSearchMatch = (searchText: string) => {
    const firstPersonId = getFirstMatchingPersonId(people, searchText);
    if (firstPersonId) setSelectedPersonId(firstPersonId);
  };

  return (
    <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(330px,420px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(380px,460px)_minmax(0,1fr)]">
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
        setSelectedPersonId={setSelectedPersonId}
        onSearchSubmit={selectFirstSearchMatch}
        reinos={reinos}
        dinastias={dinastias}
        siglos={siglos}
        mediaAssets={mediaAssets}
        mediaPreviewUrls={mediaPreviewUrls}
      />

      <PersonDetailCard
        selectedPerson={selectedPerson}
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
        setSelectedPersonId={setSelectedPersonId}
        openPersonEditor={openPersonEditor}
        openRowEditor={openRowEditor}
        setDeleteTarget={setDeleteTarget}
        setDeleteOpen={setDeleteOpen}
        addMediaUrl={addMediaUrl}
        addUploadedMedia={addUploadedMedia}
        replaceMediaAssetFile={replaceMediaAssetFile}
        updateMediaAsset={updateMediaAsset}
        removeMediaAsset={removeMediaAsset}
        setPrimaryMediaAsset={setPrimaryMediaAsset}
      />
    </div>
  );
}
