import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Admin from "@/pages/Admin";
import Cart from "@/pages/Cart";
import Collection from "@/pages/Collection";
import InfoPage from "@/pages/InfoPage";
import OrderSuccess from "@/pages/OrderSuccess";
import Orders from "@/pages/Orders";
import ProductDetail from "@/pages/ProductDetail";
import Story from "@/pages/Story";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { Providers } from "./components/Providers";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/koleksiyon" component={Collection} />
      <Route path="/urunler" component={Collection} />
      <Route path="/urun/:slug" component={ProductDetail} />
      <Route path="/hikayemiz" component={Story} />
      <Route path="/admin" component={Admin} />
      <Route path="/sepet" component={Cart} />
      <Route path="/siparis-basarili" component={OrderSuccess} />
      <Route path="/siparislerim" component={Orders} />
      <Route path="/kargo" component={() => <InfoPage params={{ topic: "kargo" }} />} />
      <Route path="/iade" component={() => <InfoPage params={{ topic: "iade" }} />} />
      <Route path="/iletisim" component={() => <InfoPage params={{ topic: "iletisim" }} />} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Providers><Router /></Providers>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
