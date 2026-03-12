import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Separator } from "../ui/separator";
import { Download, Copy } from "lucide-react";
import { downloadTextFile, generateCsv } from "../../lib/data";

export function DataTab({ rows, datasetName, setDatasetName }: any) {
  
  const exportJson = () => {
    const cleaned = rows.map((r: any) => {
      const { _duracionCalc, _duracionFuente, _rowId, ...rest } = r;
      return rest;
    });
    const text = JSON.stringify(cleaned, null, 2);
    const base = datasetName?.toLowerCase().endsWith(".json") ? datasetName : `${datasetName.replace(/\.csv$/i, '')}.json`;
    downloadTextFile(base, text, "application/json;charset=utf-8");
  };

  const exportCsv = () => {
    const text = generateCsv(rows);
    const base = datasetName?.toLowerCase().endsWith(".csv") ? datasetName : `${datasetName.replace(/\.json$/i, '')}.csv`;
    downloadTextFile(base, text, "text/csv;charset=utf-8");
  };

  return (
    <Card className="rounded-[3px] shadow-sm bg-slate-900/30 border border-slate-800">
      <CardHeader>
        <CardTitle className="text-lg font-bold tracking-tight text-slate-50">control de datos</CardTitle>
        <CardDescription className="text-base text-slate-200">
          Exporta el estado actual. No se incorpora información externa.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="space-y-2">
            <div className="text-sm text-slate-300">nombre base de archivo</div>
            <Input className="rounded-[3px] text-base font-medium bg-slate-900/60 text-slate-50 placeholder:text-slate-400 border-slate-700/60 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950" value={datasetName} onChange={(e) => setDatasetName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <div className="text-sm text-slate-300">exportación</div>
            <div className="flex gap-2 flex-wrap">
              <Button className="rounded-[3px]" onClick={exportJson}><Download className="h-4 w-4 mr-2" />JSON</Button>
              <Button className="rounded-[3px]" variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />CSV (Excel)</Button>
              <Button
                variant="secondary"
                className="rounded-[3px]"
                onClick={() => {
                  const cleaned = rows.map((r: any) => {
                    const { _duracionCalc, _duracionFuente, _rowId, ...rest } = r;
                    return rest;
                  });
                  navigator.clipboard?.writeText(JSON.stringify(cleaned, null, 2));
                }}
              >
                <Copy className="h-4 w-4 mr-2" />
                copiar JSON
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-sm text-slate-200">formato CSV</div>
            <div className="text-sm text-slate-300">
              Usa punto y coma (;) como separador. Campos con texto entre comillas dobles para soportar saltos de línea. Compatible con Excel.
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="text-sm text-slate-200">vista previa JSON (primeros 3 registros, solo lectura)</div>
          <pre className="max-h-72 overflow-auto rounded-[3px] border border-slate-800 p-4 text-sm bg-slate-950/60 text-slate-100">
            {JSON.stringify(
              rows
                .slice(0, 3)
                .map((r: any) => {
                  const { _duracionCalc, _duracionFuente, _rowId, ...rest } = r;
                  return rest;
                }),
              null,
              2
            )}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}