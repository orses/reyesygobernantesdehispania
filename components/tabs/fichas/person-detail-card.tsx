import { Badge } from "../../ui/badge";
import { Card, CardContent } from "../../ui/card";
import { Separator } from "../../ui/separator";
import { personDenominationsByKingdom } from "../../../lib/ficha-view";
import type { GovernmentSuccession } from "../../../lib/succession";
import type { MediaAsset, MediaAssetMoveDirection, MediaInputOptions, Person, RawRow } from "../../../lib/types";
import { MediaGallery } from "./media-gallery";
import { PersonDetailHeader } from "./person-detail-header";
import { PersonDescription } from "./person-description";
import { PersonSummary } from "./person-summary";
import { SectionTitle } from "./shared";

type StateSetter<T> = (value: T | ((prev: T) => T)) => void;

interface PersonDetailCardProps {
  selectedPerson: Person | null;
  selectedGovernmentRow: RawRow | null;
  successionByRowId: ReadonlyMap<string, GovernmentSuccession>;
  selectedPrimaryMediaAsset: MediaAsset | null;
  selectedMediaAssets: MediaAsset[];
  mediaPreviewUrls: Record<string, string>;
  selectedCenturies: number[];
  selectedCenturiesText: string;
  filterReino: string;
  setFilterReino: StateSetter<string>;
  filterDinastia: string;
  setFilterDinastia: StateSetter<string>;
  setFilterDinastiaLocked: StateSetter<boolean>;
  filterSiglo: string;
  setFilterSiglo: StateSetter<string>;
  setSelectedPersonId: (value: string | null) => void;
  openPersonEditor: (personId: string | number) => void;
  openRowEditor: (rowId: string | number) => void;
  setDeleteTarget: (target: { kind: string; id: string | number | null }) => void;
  setDeleteOpen: (value: boolean) => void;
  addMediaUrl?: (personId: string | number, url: string, options?: MediaInputOptions) => string | null;
  addUploadedMedia?: (personId: string | number, file: File, options?: MediaInputOptions) => Promise<string | null>;
  replaceMediaAssetFile?: (assetId: string, file: File) => Promise<boolean>;
  replaceMediaAssetUrl?: (assetId: string, url: string) => Promise<boolean>;
  moveMediaAsset?: (personId: string | number, assetId: string, direction: MediaAssetMoveDirection) => void;
  updateMediaAsset?: (assetId: string, patch: Partial<MediaAsset>) => void;
  removeMediaAsset?: (assetId: string) => Promise<void>;
  setPrimaryMediaAsset?: (personId: string | number, assetId: string) => void;
}

export function PersonDetailCard({
  selectedPerson,
  selectedGovernmentRow,
  successionByRowId,
  selectedPrimaryMediaAsset,
  selectedMediaAssets,
  mediaPreviewUrls,
  selectedCenturies,
  selectedCenturiesText,
  filterReino,
  setFilterReino,
  filterDinastia,
  setFilterDinastia,
  setFilterDinastiaLocked,
  filterSiglo,
  setFilterSiglo,
  setSelectedPersonId,
  openPersonEditor,
  openRowEditor,
  setDeleteTarget,
  setDeleteOpen,
  addMediaUrl,
  addUploadedMedia,
  replaceMediaAssetFile,
  replaceMediaAssetUrl,
  moveMediaAsset,
  updateMediaAsset,
  removeMediaAsset,
  setPrimaryMediaAsset,
}: PersonDetailCardProps) {
  const denominations = selectedPerson ? personDenominationsByKingdom(selectedPerson) : [];

  return (
    <Card className="min-w-0 rounded-[3px] shadow-sm bg-slate-900/30 border border-slate-800">
      <PersonDetailHeader
        selectedPerson={selectedPerson}
        selectedGovernmentRow={selectedGovernmentRow}
        openPersonEditor={openPersonEditor}
        setDeleteTarget={setDeleteTarget}
        setDeleteOpen={setDeleteOpen}
      />

      <CardContent className="space-y-5">
        {!selectedPerson ? (
          <div className="text-sm text-slate-300">Seleccione un personaje en el listado.</div>
        ) : (
          <>
            <PersonSummary
              selectedPerson={selectedPerson}
              selectedPrimaryMediaAsset={selectedPrimaryMediaAsset}
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
              successionByRowId={successionByRowId}
              setSelectedPersonId={setSelectedPersonId}
              openRowEditor={openRowEditor}
              setDeleteTarget={setDeleteTarget}
              setDeleteOpen={setDeleteOpen}
            />

            <Separator />

            <div className="space-y-3">
              <SectionTitle>Denominaciones por reino</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {denominations.map((denomination, index) => (
                  <Badge key={`${denomination.reino}-${index}`} variant="secondary" className="rounded-[3px]">
                    {denomination.reino ? `${denomination.reino}: ${denomination.nombre}` : denomination.nombre}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <SectionTitle>Descripción</SectionTitle>
              <PersonDescription description={selectedPerson.reinados[0]?.Descripción} />
            </div>

            <Separator />

            <MediaGallery
              personId={selectedPerson.personId}
              personName={selectedPerson.nombrePrincipal}
              assets={selectedMediaAssets}
              previewUrls={mediaPreviewUrls}
              addMediaUrl={addMediaUrl}
              addUploadedMedia={addUploadedMedia}
              replaceMediaAssetFile={replaceMediaAssetFile}
              replaceMediaAssetUrl={replaceMediaAssetUrl}
              moveMediaAsset={moveMediaAsset}
              updateMediaAsset={updateMediaAsset}
              removeMediaAsset={removeMediaAsset}
              setPrimaryMediaAsset={setPrimaryMediaAsset}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
