import { createContext, useContext, useState } from "react"

type PresentationProviderProps = {
  children: React.ReactNode
}

type PresentationProviderState = {
  isPresentationMode: boolean
  togglePresentationMode: () => void
}

const initialState: PresentationProviderState = {
  isPresentationMode: false,
  togglePresentationMode: () => null,
}

const PresentationContext = createContext<PresentationProviderState>(initialState)

export function PresentationProvider({ children }: PresentationProviderProps) {
  const [isPresentationMode, setIsPresentationMode] = useState<boolean>(false)

  const togglePresentationMode = () => {
    setIsPresentationMode((prev) => !prev)
  }

  return (
    <PresentationContext.Provider value={{ isPresentationMode, togglePresentationMode }}>
      {children}
    </PresentationContext.Provider>
  )
}

export const usePresentation = () => {
  const context = useContext(PresentationContext)

  if (context === undefined)
    throw new Error("usePresentation must be used within a PresentationProvider")

  return context
}
