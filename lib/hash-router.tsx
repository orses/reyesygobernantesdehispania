import {
  type AnchorHTMLAttributes,
  useCallback,
  useEffect,
  useState,
} from "react";

interface NavigateOptions {
  replace?: boolean;
}

interface HashLocation {
  pathname: string;
  navigate: (path: string, options?: NavigateOptions) => void;
}

const INTERNAL_PATH_PREFIX = "/";

/** Normaliza una ruta para impedir que los enlaces internos acepten otros protocolos. */
export function normalizeHashPath(path: string): string {
  const trimmedPath = path.trim();
  if (!trimmedPath) return INTERNAL_PATH_PREFIX;

  const pathWithPrefix = trimmedPath.startsWith(INTERNAL_PATH_PREFIX)
    ? trimmedPath
    : `${INTERNAL_PATH_PREFIX}${trimmedPath}`;

  return pathWithPrefix.replace(/\/{2,}/g, INTERNAL_PATH_PREFIX);
}

/** Convierte una ruta interna en un destino navegable mediante hash. */
export function toHashHref(path: string): string {
  return `#${normalizeHashPath(path)}`;
}

function readHashPath(): string {
  const rawPath = window.location.hash.slice(1).split("?", 1)[0];
  return normalizeHashPath(rawPath);
}

export function useHashLocation(): HashLocation {
  const [pathname, setPathname] = useState(readHashPath);

  useEffect(() => {
    const handleHashChange = () => setPathname(readHashPath());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const navigate = useCallback((path: string, options: NavigateOptions = {}) => {
    const normalizedPath = normalizeHashPath(path);
    const nextHash = toHashHref(normalizedPath);

    if (options.replace) {
      const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
      window.history.replaceState(window.history.state, "", nextUrl);
    } else if (window.location.hash !== nextHash) {
      window.location.hash = normalizedPath;
    }

    setPathname(normalizedPath);
  }, []);

  return { pathname, navigate };
}

type HashLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  to: string;
};

export function HashLink({ to, ...props }: HashLinkProps) {
  return <a {...props} href={toHashHref(to)} />;
}
