import { useCallback, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight, ImagePlus, Link, Replace, Star, Trash2, Upload, X } from "lucide-react";
import { Button } from "../../ui/button";
import {
  RIGHTS_OPTIONS,
  mediaAssetSrc,
  mediaAssetViewerSources,
} from "../../../lib/ficha-view";
import {
  getMediaViewerNavigationState,
  getMediaViewerNavigationTargetId,
  type MediaViewerNavigationAction,
} from "../../../lib/media-viewer-navigation";
import {
  getMediaAssetCopyValue,
  getMediaAssetRouteLabel,
  normalizeRightsStatus,
} from "../../../lib/media";
import type { MediaAsset, MediaAssetMoveDirection, MediaInputOptions, MediaRightsStatus } from "../../../lib/types";
import { MediaViewer } from "./media-viewer";
import { CopyIconButton, SectionTitle } from "./shared";

interface MediaGalleryProps {
  personId: string | number;
  personName: string;
  assets: MediaAsset[];
  previewUrls: Record<string, string>;
  addMediaUrl?: (personId: string | number, url: string, options?: MediaInputOptions) => string | null;
  addUploadedMedia?: (personId: string | number, file: File, options?: MediaInputOptions) => Promise<string | null>;
  replaceMediaAssetFile?: (assetId: string, file: File) => Promise<boolean>;
  replaceMediaAssetUrl?: (assetId: string, url: string) => Promise<boolean>;
  moveMediaAsset?: (personId: string | number, assetId: string, direction: MediaAssetMoveDirection) => void;
  updateMediaAsset?: (assetId: string, patch: Partial<MediaAsset>) => void;
  removeMediaAsset?: (assetId: string) => Promise<void>;
  setPrimaryMediaAsset?: (personId: string | number, assetId: string) => void;
}

const compactIconButtonClass = "h-9 w-9 rounded-[3px]";
const compactOutlineIconButtonClass = `${compactIconButtonClass} border-slate-700/70 bg-slate-950/35`;

export function MediaGallery({
  personId,
  personName,
  assets,
  previewUrls,
  addMediaUrl,
  addUploadedMedia,
  replaceMediaAssetFile,
  replaceMediaAssetUrl,
  moveMediaAsset,
  updateMediaAsset,
  removeMediaAsset,
  setPrimaryMediaAsset,
}: MediaGalleryProps) {
  const [urlDraft, setUrlDraft] = useState("");
  const [rightsDraft, setRightsDraft] = useState<MediaRightsStatus>("unknown");
  const [licenseDraft, setLicenseDraft] = useState("");
  const [authorDraft, setAuthorDraft] = useState("");
  const [workDateDraft, setWorkDateDraft] = useState("");
  const [viewerAssetId, setViewerAssetId] = useState<string | null>(null);
  const [replaceUrlTargetId, setReplaceUrlTargetId] = useState<string | null>(null);
  const [replaceUrlDraft, setReplaceUrlDraft] = useState("");
  const [expandedRouteIds, setExpandedRouteIds] = useState<ReadonlySet<string>>(() => new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetIdRef = useRef<string | null>(null);
  const viewerSources = useMemo(
    () => mediaAssetViewerSources(assets, previewUrls, personName),
    [assets, personName, previewUrls]
  );
  const viewerSource = viewerAssetId
    ? viewerSources.find((source) => source.id === viewerAssetId) ?? null
    : null;
  const navigateViewer = useCallback((action: MediaViewerNavigationAction) => {
    const targetId = getMediaViewerNavigationTargetId(viewerSources, viewerAssetId, action);
    if (targetId) setViewerAssetId(targetId);
  }, [viewerAssetId, viewerSources]);
  const viewerNavigation = useMemo(
    () => ({
      ...getMediaViewerNavigationState(viewerSources, viewerAssetId),
      onNavigate: navigateViewer,
    }),
    [navigateViewer, viewerAssetId, viewerSources]
  );

  const mediaDraftOptions = (): MediaInputOptions => ({
    rightsStatus: rightsDraft,
    license: licenseDraft.trim() || undefined,
    author: authorDraft.trim() || undefined,
    workDate: workDateDraft.trim() || undefined,
  });

  const resetDrafts = () => {
    setUrlDraft("");
    setRightsDraft("unknown");
    setLicenseDraft("");
    setAuthorDraft("");
    setWorkDateDraft("");
  };

  const handleAddUrl = () => {
    const createdId = addMediaUrl?.(personId, urlDraft, mediaDraftOptions());
    if (createdId) resetDrafts();
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length || !addUploadedMedia) return;
    let added = false;
    for (const file of Array.from(files)) {
      const createdId = await addUploadedMedia(personId, file, mediaDraftOptions());
      if (createdId) added = true;
    }
    if (added) resetDrafts();
  };

  const handleReplaceUpload = async (files: FileList | null) => {
    const assetId = replaceTargetIdRef.current;
    const file = files?.[0];
    if (!assetId || !file || !replaceMediaAssetFile) return;
    await replaceMediaAssetFile(assetId, file);
  };

  const openReplaceFilePicker = (assetId: string) => {
    replaceTargetIdRef.current = assetId;
    if (replaceInputRef.current) {
      replaceInputRef.current.value = "";
      replaceInputRef.current.click();
    }
  };

  const closeReplaceUrlEditor = () => {
    setReplaceUrlTargetId(null);
    setReplaceUrlDraft("");
  };

  const openReplaceUrlEditor = (asset: MediaAsset) => {
    setReplaceUrlTargetId(asset.id);
    setReplaceUrlDraft(asset.kind === "external-url" ? asset.src : "");
  };

  const handleReplaceUrl = async (assetId: string) => {
    if (!replaceMediaAssetUrl) return;
    const replaced = await replaceMediaAssetUrl(assetId, replaceUrlDraft);
    if (replaced) closeReplaceUrlEditor();
  };

  const toggleRoute = (assetId: string) => {
    setExpandedRouteIds((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <SectionTitle>Galería de imágenes</SectionTitle>

      {assets.length ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {assets.map((asset, assetIndex) => {
            const src = mediaAssetSrc(asset, previewUrls);
            const sourceText = getMediaAssetRouteLabel(asset);
            const copyValue = getMediaAssetCopyValue(asset);
            const isReplacingUrl = replaceUrlTargetId === asset.id;
            const isRouteExpanded = expandedRouteIds.has(asset.id);
            const canMoveUp = assetIndex > 0;
            const canMoveDown = assetIndex < assets.length - 1;

            return (
              <div key={asset.id} className="min-w-0 rounded-[3px] border border-slate-700/70 bg-slate-950/25 p-3">
                <button
                  type="button"
                  className={`relative aspect-[4/3] w-full overflow-hidden rounded-[3px] border border-slate-700/70 bg-slate-950/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${src ? "cursor-zoom-in" : "cursor-default"}`}
                  disabled={!src}
                  title={src ? "Abrir imagen" : undefined}
                  aria-label={src ? `Abrir ${asset.title || asset.fileName || "imagen"}` : "Sin imagen"}
                  onClick={() => {
                    if (src) setViewerAssetId(asset.id);
                  }}
                >
                  {src ? (
                    <img src={src} alt={asset.title || `imagen de ${personName}`} className="h-full w-full object-contain object-top" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">sin imagen</div>
                  )}
                  {asset.isPrimary ? (
                    <span className="absolute left-2 top-2 inline-flex items-center rounded-[3px] border border-emerald-400/40 bg-emerald-950/85 px-2 py-1 text-xs font-medium text-emerald-100">
                      Principal
                    </span>
                  ) : null}
                </button>

                <div className="mt-3 min-w-0">
                  <div className="truncate text-sm font-medium text-slate-100">{asset.title || asset.fileName || "Imagen"}</div>
                  <div className="text-xs text-slate-400">{asset.kind === "uploaded-file" ? "Subida local" : "URL externa"}</div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="min-w-0 space-y-1">
                    <span className="text-[11px] font-semibold tracking-wide text-slate-500">Nombre de la imagen</span>
                    <input
                      className="h-9 w-full rounded-[3px] border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 placeholder:text-slate-500"
                      value={asset.title ?? ""}
                      onChange={(event) => updateMediaAsset?.(asset.id, { title: event.target.value })}
                      placeholder={asset.fileName || "Retrato, grabado, escudo..."}
                    />
                  </label>

                  <label className="min-w-0 space-y-1">
                    <span className="text-[11px] font-semibold tracking-wide text-slate-500">Autor</span>
                    <input
                      className="h-9 w-full rounded-[3px] border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 placeholder:text-slate-500"
                      value={asset.author ?? asset.sourceName ?? ""}
                      onChange={(event) => updateMediaAsset?.(asset.id, { author: event.target.value })}
                      placeholder="Autor, institución o fuente"
                    />
                  </label>

                  <label className="min-w-0 space-y-1">
                    <span className="text-[11px] font-semibold tracking-wide text-slate-500">Fecha</span>
                    <input
                      className="h-9 w-full rounded-[3px] border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 placeholder:text-slate-500"
                      value={asset.workDate ?? ""}
                      onChange={(event) => updateMediaAsset?.(asset.id, { workDate: event.target.value })}
                      placeholder="1798, s. XV, c. 1650..."
                    />
                  </label>

                  <label className="min-w-0 space-y-1">
                    <span className="text-[11px] font-semibold tracking-wide text-slate-500">Licencia</span>
                    <input
                      className="h-9 w-full rounded-[3px] border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 placeholder:text-slate-500"
                      value={asset.license ?? ""}
                      onChange={(event) => updateMediaAsset?.(asset.id, { license: event.target.value })}
                      placeholder="CC BY-SA 4.0, dominio público..."
                    />
                  </label>

                  <label className="min-w-0 space-y-1">
                    <span className="text-[11px] font-semibold tracking-wide text-slate-500">Derechos</span>
                    <select
                      className="h-9 w-full min-w-0 rounded-[3px] border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100"
                      value={asset.rightsStatus}
                      onChange={(event) => updateMediaAsset?.(asset.id, { rightsStatus: normalizeRightsStatus(event.target.value) })}
                      aria-label="Estado de derechos"
                    >
                      {RIGHTS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>

                  {isReplacingUrl ? (
                    <div className="min-w-0 space-y-2 sm:col-span-2">
                      <label className="min-w-0 space-y-1">
                        <span className="text-[11px] font-semibold tracking-wide text-slate-500">URL de reemplazo</span>
                        <input
                          className="h-9 w-full rounded-[3px] border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 placeholder:text-slate-500"
                          value={replaceUrlDraft}
                          onChange={(event) => setReplaceUrlDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void handleReplaceUrl(asset.id);
                            }
                            if (event.key === "Escape") {
                              closeReplaceUrlEditor();
                            }
                          }}
                          placeholder="https://..."
                        />
                      </label>
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className={compactIconButtonClass}
                          title="Confirmar URL"
                          aria-label="Confirmar URL de reemplazo"
                          disabled={!replaceUrlDraft.trim()}
                          onClick={() => void handleReplaceUrl(asset.id)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className={compactOutlineIconButtonClass}
                          title="Cancelar"
                          aria-label="Cancelar reemplazo por URL"
                          onClick={closeReplaceUrlEditor}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>

                {isRouteExpanded ? (
                  <div id={`media-route-${asset.id}`} className="mt-3 flex items-start gap-2 rounded-[3px] border border-slate-800/80 bg-slate-950/35 p-2">
                    <div className="min-w-0 flex-1 break-all text-xs leading-5 text-slate-300">{sourceText}</div>
                    <CopyIconButton value={copyValue} label="Copiar ruta de la imagen" />
                  </div>
                ) : null}

                <div className="mt-3 flex min-w-0 items-center gap-1 overflow-x-auto pb-1">
                  <Button
                    type="button"
                    variant={asset.isPrimary ? "secondary" : "outline"}
                    size="icon"
                    className={asset.isPrimary ? compactIconButtonClass : compactOutlineIconButtonClass}
                    title="Principal"
                    aria-label={asset.isPrimary ? "Imagen principal" : "Marcar como principal"}
                    onClick={() => setPrimaryMediaAsset?.(personId, asset.id)}
                  >
                    <Star className={`h-4 w-4 ${asset.isPrimary ? "fill-current" : ""}`} />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className={compactOutlineIconButtonClass}
                    title="Subir"
                    aria-label="Subir imagen"
                    disabled={!moveMediaAsset || !canMoveUp}
                    onClick={() => moveMediaAsset?.(personId, asset.id, "up")}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className={compactOutlineIconButtonClass}
                    title="Bajar"
                    aria-label="Bajar imagen"
                    disabled={!moveMediaAsset || !canMoveDown}
                    onClick={() => moveMediaAsset?.(personId, asset.id, "down")}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className={compactOutlineIconButtonClass}
                    title="Reemplazar por archivo"
                    aria-label="Reemplazar imagen por archivo"
                    disabled={!replaceMediaAssetFile}
                    onClick={() => openReplaceFilePicker(asset.id)}
                  >
                    <Replace className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant={isReplacingUrl ? "secondary" : "outline"}
                    size="icon"
                    className={isReplacingUrl ? compactIconButtonClass : compactOutlineIconButtonClass}
                    title="Reemplazar por URL"
                    aria-label="Reemplazar imagen por URL"
                    disabled={!replaceMediaAssetUrl}
                    onClick={() => openReplaceUrlEditor(asset)}
                  >
                    <Link className="h-4 w-4" />
                  </Button>
                  <button
                    type="button"
                    className="inline-flex h-9 shrink-0 items-center gap-1 rounded-[3px] border border-slate-800/80 bg-slate-950/35 px-2 text-xs font-medium text-slate-300 hover:border-slate-700 hover:bg-slate-900/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                    aria-expanded={isRouteExpanded}
                    aria-controls={`media-route-${asset.id}`}
                    onClick={() => toggleRoute(asset.id)}
                  >
                    {isRouteExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    Ruta
                  </button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className={`${compactIconButtonClass} ml-auto shrink-0`}
                    title="Eliminar"
                    aria-label="Eliminar imagen"
                    onClick={() => removeMediaAsset?.(asset.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
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
            <div className="text-base font-medium text-slate-100">Añadir imagen</div>
            <div className="text-sm text-slate-400">URL externa o archivo local</div>
          </div>
        </div>

        <div className="grid grid-cols-1 items-end gap-3 lg:grid-cols-2 xl:grid-cols-[minmax(190px,1fr)_160px_minmax(190px,1fr)_220px_auto]">
          <label className="min-w-0 space-y-1 lg:col-span-2 xl:col-span-5">
            <span className="text-[11px] font-semibold tracking-wide text-slate-500">URL</span>
            <input
              className="h-10 w-full rounded-[3px] border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 placeholder:text-slate-400"
              value={urlDraft}
              onChange={(event) => setUrlDraft(event.target.value)}
              placeholder="URL directa de imagen"
            />
          </label>

          <label className="min-w-0 space-y-1">
            <span className="text-[11px] font-semibold tracking-wide text-slate-500">Atribución</span>
            <input
              className="h-10 w-full rounded-[3px] border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 placeholder:text-slate-500"
              value={authorDraft}
              onChange={(event) => setAuthorDraft(event.target.value)}
              placeholder="Autor, institución o fuente"
            />
          </label>

          <label className="min-w-0 space-y-1">
            <span className="text-[11px] font-semibold tracking-wide text-slate-500">Fecha</span>
            <input
              className="h-10 w-full rounded-[3px] border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 placeholder:text-slate-500"
              value={workDateDraft}
              onChange={(event) => setWorkDateDraft(event.target.value)}
              placeholder="1798, s. XV..."
            />
          </label>

          <label className="min-w-0 space-y-1">
            <span className="text-[11px] font-semibold tracking-wide text-slate-500">Licencia</span>
            <input
              className="h-10 w-full rounded-[3px] border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 placeholder:text-slate-500"
              value={licenseDraft}
              onChange={(event) => setLicenseDraft(event.target.value)}
              placeholder="CC BY 4.0, dominio público..."
            />
          </label>

          <label className="min-w-0 space-y-1">
            <span className="text-[11px] font-semibold tracking-wide text-slate-500">Derechos</span>
            <select
              className="h-10 w-full rounded-[3px] border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
              value={rightsDraft}
              onChange={(event) => setRightsDraft(normalizeRightsStatus(event.target.value))}
              aria-label="Derechos de la imagen nueva"
            >
              {RIGHTS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <div className="grid min-w-0 grid-cols-2 gap-2 justify-self-end">
            <Button type="button" className="h-10 rounded-[3px] px-3" title="Añadir URL" onClick={handleAddUrl} disabled={!urlDraft.trim()}>
              <ImagePlus className="mr-2 h-4 w-4" />
              URL
            </Button>
            <Button type="button" variant="outline" className="h-10 rounded-[3px] border-slate-700/70 bg-slate-950/35 px-3" title="Subir archivo" onClick={() => fileInputRef.current?.click()}>
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
          <input
            ref={replaceInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (event) => {
              await handleReplaceUpload(event.target.files);
              event.target.value = "";
              replaceTargetIdRef.current = null;
            }}
          />
        </div>
      </div>

      <MediaViewer
        source={viewerSource}
        onClose={() => setViewerAssetId(null)}
        navigation={viewerNavigation}
      />
    </div>
  );
}
