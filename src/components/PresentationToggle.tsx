import { Eye, EyeOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { usePresentation } from "@/components/presentation-provider"

export function PresentationToggle() {
  const { isPresentationMode, togglePresentationMode } = usePresentation()

  return (
    <Button
      variant="outline"
      size="sm"
      className={`h-9 hidden sm:flex items-center gap-2 border-border transition-colors ${
        isPresentationMode ? "bg-primary/10 text-primary border-primary/30" : "bg-transparent text-foreground hover:bg-muted"
      }`}
      onClick={togglePresentationMode}
    >
      {isPresentationMode ? (
        <>
          <EyeOff className="h-4 w-4" />
          <span>Apresentação Ativa</span>
        </>
      ) : (
        <>
          <Eye className="h-4 w-4" />
          <span>Apresentação</span>
        </>
      )}
    </Button>
  )
}
