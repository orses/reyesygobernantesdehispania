import { Copy, Download } from "lucide-react";
import { downloadTextFile, generateCsv } from "../../lib/data";
import { cleanRowsForExport, createDatasetPayload, getTimestampedExportFileName, toPortableMediaAsset } from "../../lib/dataset-package";
import { applyMediaAssetsToRows } from "../../lib/media";
import {
  PRINT_RESOLUTION_PROFILE_OPTIONS,
  type ImagePrintResolutionProfile,
} from "../../lib/print-resolution";
import type { MediaAsset, RawRow } from "../../lib/types";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Separator } from "../ui/separator";

interface DataTabProps {
  rows: RawRow[];
  datasetName: string;
  setDatasetName: (value: string) => void;
  mediaAssets?: MediaAsset[];
  imagePrintProfile: ImagePrintResolutionProfile;
  setImagePrintProfile: (value: ImagePrintResolutionProfile) => void;
  exportDatasetPackage?: (profile?: ImagePrintResolutionProfile) => Promise<void> | void;
}

export function DataTab({
  rows,
  datasetName,
  setDatasetName,
  mediaAssets = [],
  imagePrintProfile,
  setImagePrintProfile,
  exportDatasetPackage,
}: DataTabProps) {
  const exportJson = () => {
    const exportedDate = new Date();
    const payload = createDatasetPayload(rows, mediaAssets, exportedDate.toISOString(), datasetName);
    const text = JSON.stringify(payload, null, 2);
    downloadTextFile(getTimestampedExportFileName(datasetName, "json", exportedDate), text, "application/json;charset=utf-8");
  };

  const exportCsv = () => {
    const text = generateCsv(applyMediaAssetsToRows(rows, mediaAssets));
    downloadTextFile(getTimestampedExportFileName(datasetName, "csv"), text, "text/csv;charset=utf-8");
  };

  const uploadedCount = mediaAssets.filter((asset) => asset.kind === "uploaded-file").length;

  return (
    <Card className="rounded-[3px] shadow-sm bg-slate-900/30 border border-slate-800">
      <CardHeader>
        <CardTitle className="text-lg font-medium tracking-tight text-slate-50">control de datos</CardTitle>
        <CardDescription className="text-base text-slate-200">
          Exporta el estado actual. No se incorpora información externa.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(260px,360px)_minmax(0,1fr)_minmax(280px,420px)]">
          <div className="space-y-2">
            <div className="text-sm text-slate-300">nombre base de archivo</div>
            <Input className="rounded-[3px] text-base font-medium bg-slate-900/60 text-slate-50 placeholder:text-slate-400 border-slate-700/60 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950" value={datasetName} onChange={(e) => setDatasetName(e.target.value)} />
            <div className="space-y-1">
              <div className="text-sm text-slate-300">imágenes en ZIP</div>
              <Select
                value={imagePrintProfile}
                onValueChange={(value) => setImagePrintProfile(value as ImagePrintResolutionProfile)}
              >
                <SelectTrigger className="h-9 cursor-pointer rounded-[3px] border-slate-700/70 bg-slate-950/30 text-slate-50 hover:bg-slate-900/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-950 text-slate-50 border-slate-800">
                  {PRINT_RESOLUTION_PROFILE_OPTIONS.map((option) => (
                    <SelectItem
                      key={option.value}
                      className="text-slate-100 focus:bg-slate-800 focus:text-slate-50"
                      value={option.value}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-sm text-slate-300">exportación</div>
            <div className="flex flex-wrap gap-2">
              <Button
                className="rounded-[3px]"
                onClick={() => exportDatasetPackage?.(imagePrintProfile)}
                disabled={!exportDatasetPackage}
                title="Guarda TODO: datos, URLs y los archivos de imagen que has subido. Es el único formato que no pierde nada; úsalo como respaldo y para reimportar completo."
              >
                <Download className="h-4 w-4 mr-2" />ZIP completo (guardar todo)
              </Button>
              <Button
                className="rounded-[3px]"
                variant="outline"
                onClick={exportCsv}
                title="Tabla de datos + todas las URLs de imágenes. Las imágenes subidas se listan por su ruta estable (columna «Imágenes subidas (rutas, solo en ZIP)») pero el archivo NO se incluye. Ideal para abrir en Excel."
              >
                <Download className="h-4 w-4 mr-2" />CSV (Excel)
              </Button>
              <Button
                className="rounded-[3px]"
                variant="outline"
                onClick={exportJson}
                title="Datos + fichas de imágenes (autor, licencia, URLs). No incluye los archivos subidos. Útil como respaldo solo de datos."
              >
                <Download className="h-4 w-4 mr-2" />JSON
              </Button>
              <Button
                variant="secondary"
                className="rounded-[3px]"
                onClick={() => {
                  navigator.clipboard?.writeText(JSON.stringify(createDatasetPayload(rows, mediaAssets, undefined, datasetName), null, 2));
                }}
                title="Copia el JSON de datos al portapapeles (sin los archivos subidos)."
              >
                <Copy className="h-4 w-4 mr-2" />
                copiar JSON
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-sm text-slate-200">¿Qué guarda cada formato?</div>
            <ul className="space-y-1 text-sm text-slate-300">
              <li><span className="font-medium text-slate-100">ZIP completo</span>: datos + URLs + los {uploadedCount} archivo(s) de imagen subido(s). Guárdalo para no perder nada.</li>
              <li><span className="font-medium text-slate-100">CSV</span>: datos y todas las URLs. Las imágenes subidas se listan por su ruta, pero el archivo no viaja aquí. Para Excel (separador «;»).</li>
              <li><span className="font-medium text-slate-100">JSON</span>: datos y fichas completas de imágenes (nombre, fecha de la obra, autor, licencia, ruta), sin los archivos subidos.</li>
            </ul>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="text-sm text-slate-200">vista previa JSON (primeros 3 registros, solo lectura)</div>
          <pre className="max-h-72 overflow-auto rounded-[3px] border border-slate-800 p-4 text-sm bg-slate-950/60 text-slate-100">
            {JSON.stringify(
              {
                datos: cleanRowsForExport(rows.slice(0, 3)),
                mediaAssets: mediaAssets.slice(0, 3).map((asset) => toPortableMediaAsset(asset)),
              },
              null,
              2
            )}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
