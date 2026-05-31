import { ShieldCheck } from "lucide-react";
import { Button } from "../../ui/button";
import { asNumberOrNull } from "../../../lib/data";
import {
  calculatedMeta,
  centuryBadgeStyle,
  chronologyMeta,
  dynastyBadgeStyle,
  extractYear,
  isApproxDate,
  kingdomColor,
  personImageFallbackUrl,
  personLifeFields,
  personRahUrl,
} from "../../../lib/ficha-view";
import type { MediaAsset, Person } from "../../../lib/types";
import { GovernmentList } from "./government-list";
import {
  CopyIconButton,
  Field,
  MediaFigure,
  VitalField,
} from "./shared";

type StateSetter<T> = (value: T | ((prev: T) => T)) => void;

interface PersonSummaryProps {
  selectedPerson: Person;
  selectedPrimaryMediaAsset: MediaAsset | null;
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
  openRowEditor: (rowId: string | number) => void;
  setDeleteTarget: (target: { kind: string; id: string | number | null }) => void;
  setDeleteOpen: (value: boolean) => void;
}

export function PersonSummary({
  selectedPerson,
  selectedPrimaryMediaAsset,
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
  openRowEditor,
  setDeleteTarget,
  setDeleteOpen,
}: PersonSummaryProps) {
  const lifeFields = personLifeFields(selectedPerson);
  const rahUrl = personRahUrl(selectedPerson);
  const hasClassification = Boolean(selectedPerson.dinastia) || selectedCenturies.length > 0;

  return (
    <div className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-4 xl:grid-cols-[minmax(260px,360px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(300px,420px)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-3">
        <MediaFigure
          asset={selectedPrimaryMediaAsset}
          previewUrls={mediaPreviewUrls}
          fallbackUrl={personImageFallbackUrl(selectedPerson)}
          alt={`imagen de ${selectedPerson.nombrePrincipal}`}
        />

        {rahUrl ? (
          <div className="flex items-center gap-1">
            <a
              className="inline-flex flex-1 cursor-pointer items-center justify-center rounded-[3px] px-4 py-2 text-sm font-semibold bg-slate-950/30 border border-emerald-400/40 text-slate-50 hover:bg-slate-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              title="Abrir ficha en la Real Academia de la Historia"
              href={rahUrl}
              target="_blank"
              rel="noopener noreferrer">
              <ShieldCheck className="h-4 w-4 mr-2" />
              Ficha RAH
            </a>
            <CopyIconButton value={rahUrl} label="Copiar ruta de la ficha" />
          </div>
        ) : null}
      </div>

      <div className="min-w-0 space-y-4">
        {selectedPerson.reinos?.length || hasClassification ? (
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {selectedPerson.reinos?.map((reino: string) => {
                const color = kingdomColor(reino);
                const isActive = filterReino === reino;
                return (
                  <Button
                    key={reino}
                    type="button"
                    variant={isActive ? "secondary" : "outline"}
                    className="cursor-pointer rounded-[3px] text-white hover:opacity-80"
                    style={{
                      backgroundColor: isActive ? (color || "#34d399") : (color ? color + "cc" : "rgba(2,6,23,0.3)"),
                      borderColor: color || "rgba(100,116,139,0.7)",
                    }}
                    title="conmutar filtro por reino"
                    onClick={() => setFilterReino((prev) => (prev === reino ? "__all__" : reino))}
                  >
                    {reino}
                  </Button>
                );
              })}
            </div>

            {hasClassification ? (
              <div className="flex flex-wrap items-center gap-2">
                {selectedPerson.dinastia ? (
              <Button
                type="button"
                variant={filterDinastia === String(selectedPerson.dinastia) ? "secondary" : "outline"}
                className="cursor-pointer rounded-[3px] border font-bold hover:opacity-85"
                style={dynastyBadgeStyle(
                  String(selectedPerson.dinastia),
                  filterDinastia === String(selectedPerson.dinastia)
                )}
                title="conmutar filtro por dinastía"
                onClick={() => {
                  const dinastia = String(selectedPerson.dinastia);
                  if (filterDinastia === dinastia) {
                    setFilterDinastia("__all__");
                    setFilterDinastiaLocked(false);
                  } else {
                    setFilterDinastia(dinastia);
                    setFilterDinastiaLocked(true);
                  }
                }}
              >
                {String(selectedPerson.dinastia)}
              </Button>
            ) : null}

            {selectedCenturies.length ? (
              (() => {
                const activeCentury = asNumberOrNull(filterSiglo);
                const isCenturyActive = activeCentury !== null && selectedCenturies.includes(activeCentury);

                return (
                  <Button
                    type="button"
                    variant={isCenturyActive ? "secondary" : "outline"}
                    className="cursor-pointer rounded-[3px] border font-bold hover:opacity-85"
                    style={centuryBadgeStyle(String(selectedCenturies[0]), isCenturyActive)}
                    title="conmutar filtro por siglo"
                    onClick={() => {
                      if (isCenturyActive) {
                        setFilterSiglo("__all__");
                      } else {
                        setFilterSiglo(String(selectedCenturies[0]));
                      }
                    }}
                  >
                    {selectedCenturiesText}
                  </Button>
                );
              })()
            ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-flow-col sm:grid-cols-2 sm:grid-rows-2">
          <VitalField
            label="Nacimiento"
            value={lifeFields.birthDisplay}
            emphasis={extractYear(lifeFields.birthDisplay)}
            meta={chronologyMeta(lifeFields.birthRaw)}
          />
          <VitalField
            label="Fallecimiento"
            value={lifeFields.deathDisplay}
            emphasis={extractYear(lifeFields.deathDisplay)}
            meta={chronologyMeta(lifeFields.deathRaw)}
          />

          <Field label="Enterramiento" value={selectedPerson.reinados[0]?.Enterramiento} />

          {selectedPerson.age !== null ? (
            <VitalField
              label="Edad"
              value="años"
              emphasis={
                (isApproxDate(selectedPerson.birthRaw) || isApproxDate(selectedPerson.deathRaw) ? "~" : "") +
                String(selectedPerson.age)
              }
              meta={calculatedMeta("Calculado desde nacimiento y fallecimiento. Si una fecha es aproximada, la edad también lo es.")}
            />
          ) : (
            <Field label="Edad" value={null} />
          )}
        </div>

        <GovernmentList
          selectedPerson={selectedPerson}
          openRowEditor={openRowEditor}
          setDeleteTarget={setDeleteTarget}
          setDeleteOpen={setDeleteOpen}
        />
      </div>
    </div>
  );
}
