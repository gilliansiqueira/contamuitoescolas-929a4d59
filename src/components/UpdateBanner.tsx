import { RefreshCw } from "lucide-react";
import { useAppVersionCheck } from "@/hooks/useAppVersionCheck";

export const UpdateBanner = () => {
  const { updateAvailable } = useAppVersionCheck();

  if (!updateAvailable) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] flex items-center justify-center gap-3 border-t border-border bg-background/95 px-4 py-2.5 text-sm shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <span className="text-muted-foreground">Nova versão disponível.</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Atualizar
      </button>
    </div>
  );
};
