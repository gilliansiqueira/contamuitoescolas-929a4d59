import { useCallback, useEffect, useState } from "react";

declare const __BUILD_VERSION__: string | undefined;

const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutos

/**
 * Compara a versão embutida no build atual com a versão publicada no servidor
 * (public/version.json). Se forem diferentes, há uma versão nova disponível.
 * A checagem é leve e silenciosa: qualquer erro é ignorado.
 */
export const useAppVersionCheck = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const buildVersion = typeof __BUILD_VERSION__ === "string" ? __BUILD_VERSION__ : null;

  const check = useCallback(async () => {
    if (!buildVersion) return;
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { version?: string };
      if (typeof data.version === "string" && data.version !== buildVersion) {
        setUpdateAvailable(true);
      }
    } catch {
      // Silencioso: sem acesso ao servidor, nada é feito.
    }
  }, [buildVersion]);

  useEffect(() => {
    if (!buildVersion) return;
    void check();

    const interval = window.setInterval(() => {
      void check();
    }, CHECK_INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [buildVersion, check]);

  return { updateAvailable };
};
