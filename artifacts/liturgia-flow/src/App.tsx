import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { AuthProvider, useAuth } from "@/context/auth";
import AdminPage from "@/pages/admin";
import ReaderPortal from "@/pages/reader";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function ProtectedAdmin() {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Redirect to="/lector" />;
  return <AdminPage />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={ProtectedAdmin} />
      <Route path="/lector" component={ReaderPortal} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Layout>
              <Router />
            </Layout>
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
