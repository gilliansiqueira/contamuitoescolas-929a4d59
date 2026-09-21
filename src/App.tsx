import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PresentationProvider } from "@/components/presentation-provider";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ThemeProvider } from "@/components/theme-provider";

const Index = lazy(() => import("./pages/Index.tsx"));
const Auth = lazy(() => import("./pages/Auth.tsx"));
const Demo = lazy(() => import("./pages/Demo.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const RouteLoading = () => (
  <div className="min-h-screen bg-background flex items-center justify-center text-sm text-muted-foreground">
    Carregando…
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <BrowserRouter>
        <AuthProvider>
          <PresentationProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <Suspense fallback={<RouteLoading />}>
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/demo" element={<Demo />} />
                  <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </TooltipProvider>
          </PresentationProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
