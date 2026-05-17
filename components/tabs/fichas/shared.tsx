import { useEffect, useState } from "react";
import type * as React from "react";
import { Copy } from "lucide-react";
import { Button } from "../../ui/button";
import { normalizeUrl } from "../../../lib/data";
import { mediaAssetSrc } from "../../../lib/ficha-view";
import type { DataMeta, DataMetaKind } from "../../../lib/ficha-view";
import type { MediaAsset } from "../../../lib/types";

export function DataBadge({
  children,
  style,
  title,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  title?: string;
}) {
  return (
    <span
      className="inline-flex max-w-full items-center rounded-[3px] border px-2 py-0.5 text-xs font-bold leading-5 text-slate-100"
      style={style}
      title={title}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-slate-800 pb-2">
      <h2 className="border-l-2 border-emerald-400/70 pl-3 text-base font-black tracking-wide text-slate-100">{children}</h2>
    </div>
  );
}

export function DataStatusPill({ meta }: { meta: DataMeta }) {
  const styles: Record<DataMetaKind, string> = {
    original: "border-slate-600/70 bg-slate-900/80 text-slate-300",
    inferred: "border-amber-400/45 bg-amber-950/55 text-amber-100",
    calculated: "border-sky-400/45 bg-sky-950/55 text-sky-100",
  };
  const code: Record<DataMetaKind, string> = {
    original: "O",
    inferred: "I",
    calculated: "C",
  };

  return (
    <span
      className={`inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border text-[9px] font-black leading-none ${styles[meta.kind]}`}
      title={meta.tooltip}
      aria-label={meta.tooltip}
    >
      {code[meta.kind]}
    </span>
  );
}

async function copyTextToClipboard(value: string): Promise<void> {
  const text = value.trim();
  if (!text) return;

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  if (typeof document === "undefined") return;

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export function CopyIconButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const text = value.trim();

  if (!text) return null;

  const handleCopy = async () => {
    await copyTextToClipboard(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="h-7 w-7 shrink-0 rounded-[3px] border-slate-700/70 bg-slate-950/30 text-slate-100 hover:bg-slate-900/70 hover:text-slate-50"
      title={copied ? "Copiado" : label}
      aria-label={copied ? "Copiado" : label}
      onClick={() => {
        void handleCopy();
      }}
    >
      <Copy className="h-3.5 w-3.5" />
    </Button>
  );
}

export function SafeThumb({
  url,
  alt = "",
  className = "",
}: {
  url: unknown;
  alt?: string;
  className?: string;
}) {
  const u = normalizeUrl(url);
  const [ok, setOk] = useState(true);

  useEffect(() => {
    setOk(true);
  }, [u]);

  if (!u || !ok) {
    return (
      <div
        className={`h-14 w-12 shrink-0 rounded-[3px] border border-slate-700/70 bg-slate-950/30 flex items-center justify-center text-[10px] font-semibold text-slate-300 ${className}`}
        aria-label="sin imagen"
      >
        —
      </div>
    );
  }

  return (
    <img
      src={u}
      alt={alt}
      className={`h-14 w-12 shrink-0 rounded-[3px] border border-slate-700/70 object-cover object-top ${className}`}
      loading="lazy"
      onError={() => setOk(false)}
    />
  );
}

export function SafeFigure({ url, alt = "imagen" }: { url: unknown; alt?: string }) {
  const u = normalizeUrl(url);
  const [ok, setOk] = useState(true);

  useEffect(() => {
    setOk(true);
  }, [u]);

  if (!u || !ok) {
    return (
      <div className="flex aspect-[4/5] items-center justify-center rounded-[3px] border border-slate-700/70 bg-slate-950/25 p-4 text-sm text-slate-200">sin imagen</div>
    );
  }

  return (
    <a
      href={u}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-[3px] border border-slate-700/70 bg-slate-950/25 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      title="abrir imagen en una pestaña nueva"
    >
      <img src={u} alt={alt} className="w-full h-auto object-cover object-top" onError={() => setOk(false)} />
    </a>
  );
}

export function MediaThumb({
  asset,
  previewUrls,
  fallbackUrl,
  alt = "",
  className = "",
}: {
  asset: MediaAsset | null;
  previewUrls: Record<string, string>;
  fallbackUrl?: string;
  alt?: string;
  className?: string;
}) {
  const u = mediaAssetSrc(asset, previewUrls) || normalizeUrl(fallbackUrl);
  const [ok, setOk] = useState(true);

  useEffect(() => {
    setOk(true);
  }, [u]);

  if (!u || !ok) {
    return (
      <div
        className={`h-14 w-12 shrink-0 rounded-[3px] border border-slate-700/70 bg-slate-950/30 flex items-center justify-center text-[10px] font-semibold text-slate-300 ${className}`}
        aria-label="sin imagen"
      >
        —
      </div>
    );
  }

  return (
    <img
      src={u}
      alt={alt}
      className={`h-14 w-12 shrink-0 rounded-[3px] border border-slate-700/70 object-cover object-top ${className}`}
      loading="lazy"
      onError={() => setOk(false)}
    />
  );
}

export function MediaFigure({
  asset,
  previewUrls,
  fallbackUrl,
  alt = "imagen",
}: {
  asset: MediaAsset | null;
  previewUrls: Record<string, string>;
  fallbackUrl?: string;
  alt?: string;
}) {
  const u = mediaAssetSrc(asset, previewUrls) || normalizeUrl(fallbackUrl);
  const [ok, setOk] = useState(true);

  useEffect(() => {
    setOk(true);
  }, [u]);

  if (!u || !ok) {
    return (
      <div className="rounded-[3px] border border-slate-700/70 bg-slate-950/25 p-4 text-sm text-slate-200">sin imagen</div>
    );
  }

  const image = <img src={u} alt={alt} className="w-full max-h-[min(56vh,560px)] object-contain object-top bg-slate-950/40" onError={() => setOk(false)} />;

  if (!asset || asset.kind === "external-url") {
    return (
      <a
        href={u}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-[3px] border border-slate-700/70 bg-slate-950/25 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        title="abrir imagen en una pestaña nueva"
      >
        {image}
      </a>
    );
  }

  return (
    <div className="rounded-[3px] border border-slate-700/70 bg-slate-950/25 overflow-hidden">
      {image}
    </div>
  );
}

export function VerifiedBadge({ verified }: { verified: boolean }) {
  if (verified) return null;

  return (
    <div className="flex items-center justify-center" title="no verificado" aria-label="no verificado">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-red-500">
        <circle cx="12" cy="12" r="10" strokeOpacity="0.8" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <path d="M12 17h.01" />
      </svg>
    </div>
  );
}

export function Field({
  label,
  value,
  fallback = "—",
  meta,
}: {
  label: string;
  value: unknown;
  fallback?: string;
  meta?: DataMeta;
}) {
  const displayValue = value ? String(value) : fallback;

  return (
    <div className="min-w-0 rounded-[3px] border border-slate-800/70 bg-slate-950/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-[11px] font-black tracking-wide text-slate-400">{label}</div>
        {meta ? <DataStatusPill meta={meta} /> : null}
      </div>
      <div className="mt-1 break-words text-base font-semibold text-slate-50">{displayValue}</div>
    </div>
  );
}
