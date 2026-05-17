import { ShieldCheck } from "lucide-react";
import { Button } from "../../ui/button";
import { asNumberOrNull } from "../../../lib/data";
import {
  calculatedMeta,
  centuryBadgeStyle,
  chronologyMeta,
  dynastyBadgeStyle,
  isApproxDate,
  kingdomColor,
  personImageFallbackUrl,
  personLifeFields,
  personRahUrl,
} from "../../../lib/ficha-view";
import type { MediaAsset, Person } from "../../../lib/types";
import {
  CopyIconButton,
  Field,
  MediaFigure,
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
}: PersonSummaryProps) {
  const lifeFields = personLifeFields(selectedPerson);
  const rahUrl = personRahUrl(selectedPerson);

  return (
    <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(260px,360px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(300px,420px)_minmax(0,1fr)]">
      <div className="min-w-0">
        <MediaFigure
          asset={selectedPrimaryMediaAsset}
          previewUrls={mediaPreviewUrls}
          fallbackUrl={personImageFallbackUrl(selectedPerson)}
          alt={`imagen de ${selectedPerson.nombrePrincipal}`}
        />
      </div>

      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap gap-2">
          {rahUrl ? (
            <div className="inline-flex items-center gap-1 rounded-[3px]">
              <a
                className="inline-flex cursor-pointer items-center rounded-[3px] px-4 py-2 text-sm font-semibold bg-slate-950/30 border border-emerald-400/40 text-slate-50 hover:bg-slate-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
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

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 2xl:grid-cols-3">
          <Field
            label="Nacimiento"
            value={lifeFields.birthDisplay}
            meta={chronologyMeta(lifeFields.birthRaw)}
          />
          <Field
            label="Fallecimiento"
            value={lifeFields.deathDisplay}
            meta={chronologyMeta(lifeFields.deathRaw)}
          />

          <Field label="Enterramiento" value={selectedPerson.reinados[0]?.Enterramiento} />
          <Field
            label="Siglos"
            value={selectedCenturiesText}
            meta={calculatedMeta("Calculado desde el inicio de los gobiernos.")}
          />

          {selectedPerson.age !== null && (
            <Field
              label="Edad"
              value={
                (isApproxDate(selectedPerson.birthRaw) || isApproxDate(selectedPerson.deathRaw)
                  ? "~"
                  : "") + `${selectedPerson.age} años`
              }
              meta={calculatedMeta("Calculado desde nacimiento y fallecimiento. Si una fecha es aproximada, la edad también lo es.")}
            />
          )}

          <div className="space-y-1 sm:col-span-2 2xl:col-span-3">
            <div className="text-sm font-semibold text-slate-200">Reinos</div>
            {selectedPerson.reinos?.length ? (
              <div className="flex flex-wrap gap-2">
                {selectedPerson.reinos.map((reino: string) => {
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
            ) : (
              <div className="text-base font-medium text-slate-50">—</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
