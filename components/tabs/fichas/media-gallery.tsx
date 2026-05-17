import { useRef, useState } from "react";
import { ImagePlus, Star, Trash2, Upload } from "lucide-react";
import { Button } from "../../ui/button";
import {
  RIGHTS_OPTIONS,
  mediaAssetSrc,
  rightsLabel,
} from "../../../lib/ficha-view";
import {
  getMediaAssetCopyValue,
  getMediaAssetRouteLabel,
  normalizeRightsStatus,
} from "../../../lib/media";
import type { MediaAsset, MediaInputOptions, MediaRightsStatus } from "../../../lib/types";
import { CopyIconButton, SectionTitle } from "./shared";

interface MediaGalleryProps {
  personId: string | number;
  personName: string;
  assets: MediaAsset[];
  previewUrls: Record<string, string>;
  addMediaUrl?: (personId: string | number, url: string, options?: MediaInputOptions) => string | null;
  addUploadedMedia?: (personId: string | number, file: File, options?: MediaInputOptions) => Promise<string | null>;
  updateMediaAsset?: (assetId: string, patch: Partial<MediaAsset>) => void;
  removeMediaAsset?: (assetId: string) => Promise<void>;
  setPrimaryMediaAsset?: (personId: string | number, assetId: string) => void;
}

export function MediaGallery({
  personId,
  personName,
  assets,
  previewUrls,
  addMediaUrl,
  addUploadedMedia,
  updateMediaAsset,
  removeMediaAsset,
  setPrimaryMediaAsset,
}: MediaGalleryProps) {
  const [urlDraft, setUrlDraft] = useState("");
  const [rightsDraft, setRightsDraft] = useState<MediaRightsStatus>("unknown");
  const [licenseDraft, setLicenseDraft] = useState("");
  const [authorDraft, setAuthorDraft] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mediaDraftOptions = (): MediaInputOptions => ({
    rightsStatus: rightsDraft,
    license: licenseDraft.trim() || undefined,
    author: authorDraft.trim() || undefined,
  });

  const handleAddUrl = () => {
    const createdId = addMediaUrl?.(personId, urlDraft, mediaDraftOptions());
    if (createdId) setUrlDraft("");
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length || !addUploadedMedia) return;
    for (const file of Array.from(files)) {
      await addUploadedMedia(personId, file, mediaDraftOptions());
    }
  };

  return (
    <div className="space-y-4">
      <SectionTitle>Galería de imágenes</SectionTitle>

      {assets.length ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {assets.map((asset) => {
            const src = mediaAssetSrc(asset, previewUrls);
            const sourceText = getMediaAssetRouteLabel(asset);
            const copyValue = getMediaAssetCopyValue(asset);

            return (
              <div key={asset.id} className="min-w-0 rounded-[3px] border border-slate-700/70 bg-slate-950/25 p-3">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[3px] border border-slate-700/70 bg-slate-950/60">
                  {src ? (
                    <img src={src} alt={asset.title || `imagen de ${personName}`} className="h-full w-full object-cover object-top" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">sin imagen</div>
                  )}
                  {asset.isPrimary ? (
                    <span className="absolute left-2 top-2 inline-flex items-center rounded-[3px] border border-emerald-400/40 bg-emerald-950/85 px-2 py-1 text-xs font-semibold text-emerald-100">
                      Principal
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-100">{asset.title || asset.fileName || "Imagen"}</div>
                  <div className="text-xs text-slate-400">{asset.kind === "uploaded-file" ? "Subida local" : "URL externa"}</div>
                </div>

                <div className="mt-3 flex items-start gap-2 rounded-[3px] border border-slate-800/80 bg-slate-950/35 p-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-black tracking-wide text-slate-500">Ruta</div>
                    <div className="break-all text-xs leading-5 text-slate-300">{sourceText}</div>
                  </div>
                  <CopyIconButton value={copyValue} label="Copiar ruta de la imagen" />
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="min-w-0 space-y-1">
                    <span className="text-[11px] font-black tracking-wide text-slate-500">Licencia</span>
                    <input
                      className="h-9 w-full rounded-[3px] border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 placeholder:text-slate-500"
                      value={asset.license ?? ""}
                      onChange={(event) => updateMediaAsset?.(asset.id, { license: event.target.value })}
                      placeholder="CC BY-SA 4.0, dominio público..."
                    />
                  </label>

                  <label className="min-w-0 space-y-1">
                    <span className="text-[11px] font-black tracking-wide text-slate-500">Atribución / autor</span>
                    <input
                      className="h-9 w-full rounded-[3px] border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 placeholder:text-slate-500"
                      value={asset.author ?? asset.sourceName ?? ""}
                      onChange={(event) => updateMediaAsset?.(asset.id, { author: event.target.value })}
                      placeholder="Autor, institución o fuente"
                    />
                  </label>
                </div>

                <div className="mt-3 grid grid-cols-1 items-center gap-2 lg:grid-cols-[minmax(0,1fr)_auto]">
                  <select
                    className="h-8 min-w-0 rounded-[3px] border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100"
                    value={asset.rightsStatus}
                    onChange={(event) => updateMediaAsset?.(asset.id, { rightsStatus: normalizeRightsStatus(event.target.value) })}
                    aria-label="Estado de derechos"
                  >
                    {RIGHTS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>

                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant={asset.isPrimary ? "secondary" : "outline"}
                      className="h-8 rounded-[3px] px-2 text-xs"
                      title={asset.isPrimary ? "Imagen principal" : "Marcar como principal"}
                      aria-label={asset.isPrimary ? "Imagen principal" : "Marcar como principal"}
                      onClick={() => setPrimaryMediaAsset?.(personId, asset.id)}
                    >
                      <Star className="mr-1 h-4 w-4" />
                      {asset.isPrimary ? "Principal" : "Hacer principal"}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="h-8 w-8 rounded-[3px]"
                      title="Eliminar imagen"
                      aria-label="Eliminar imagen"
                      onClick={() => removeMediaAsset?.(asset.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex min-h-40 items-center justify-center rounded-[3px] border border-dashed border-slate-700/80 bg-slate-950/20 p-4 text-sm text-slate-300">
          No hay imágenes asociadas.
        </div>
      )}

      <div className="rounded-[3px] border border-slate-700/70 bg-slate-950/25 p-4">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-base font-bold text-slate-100">Añadir imagen</div>
            <div className="text-sm text-slate-400">URL externa o archivo local</div>
          </div>
          <div className="text-xs text-slate-400">Derechos: {rightsLabel(rightsDraft)}</div>
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_240px_220px]">
          <input
            className="h-10 rounded-[3px] border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 placeholder:text-slate-400"
            value={urlDraft}
            onChange={(event) => setUrlDraft(event.target.value)}
            placeholder="URL directa de imagen"
          />
          <select
            className="h-10 rounded-[3px] border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            value={rightsDraft}
            onChange={(event) => setRightsDraft(normalizeRightsStatus(event.target.value))}
            aria-label="Derechos de la imagen nueva"
          >
            {RIGHTS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2">
            <Button type="button" className="h-10 rounded-[3px]" onClick={handleAddUrl} disabled={!urlDraft.trim()}>
              <ImagePlus className="mr-2 h-4 w-4" />
              Añadir URL
            </Button>
            <Button type="button" variant="outline" className="h-10 rounded-[3px] border-slate-700/70 bg-slate-950/35" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              Subir
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={async (event) => {
              await handleUpload(event.target.files);
              event.target.value = "";
            }}
          />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="min-w-0 space-y-1">
            <span className="text-[11px] font-black tracking-wide text-slate-500">Licencia concreta</span>
            <input
              className="h-10 w-full rounded-[3px] border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 placeholder:text-slate-500"
              value={licenseDraft}
              onChange={(event) => setLicenseDraft(event.target.value)}
              placeholder="CC BY 4.0, CC BY-SA 3.0, dominio público..."
            />
          </label>

          <label className="min-w-0 space-y-1">
            <span className="text-[11px] font-black tracking-wide text-slate-500">Atribución / autor</span>
            <input
              className="h-10 w-full rounded-[3px] border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 placeholder:text-slate-500"
              value={authorDraft}
              onChange={(event) => setAuthorDraft(event.target.value)}
              placeholder="Autor, institución o fuente"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
