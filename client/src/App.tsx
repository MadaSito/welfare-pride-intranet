import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardLayout from "@/components/DashboardLayout";
import { ModulePlaceholder } from "@/pages/ModulePlaceholder";
import NotFound from "@/pages/NotFound";
import { ArchiveRestore, Building2, CalendarDays, CalendarHeart, CloudCog, FileText, Info, Laptop, Link2, Megaphone, Network, Settings, Users, UsersRound } from "lucide-react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import People from "./pages/People";
import Organization from "./pages/Organization";
import Calendars from "./pages/Calendars";
import Announcements from "./pages/Announcements";
import Events from "./pages/Events";
import HumanResources from "./pages/HumanResources";
import Technology from "./pages/Technology";
import ImportantLinks from "./pages/ImportantLinks";
import About from "./pages/About";
import Founders from "./pages/Founders";
import AdminSettings from "./pages/AdminSettings";
import BackupCenter from "./pages/BackupCenter";
import RestoreHistory from "./pages/RestoreHistory";
import AccessPages from "./pages/AccessPages";
import BusinessManagement from "./pages/BusinessManagement";
import CustomPortalPage from "./pages/CustomPortalPage";
import { RequireAdmin } from "./components/RequireAdmin";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/people" component={People} />
        <Route path="/people/me" component={People} />
        <Route path="/organization" component={Organization} />
        <Route path="/calendars" component={Calendars} />
        <Route path="/announcements" component={Announcements} />
        <Route path="/events" component={Events} />
        <Route path="/hr" component={HumanResources} />
        <Route path="/links" component={ImportantLinks} />
        <Route path="/about" component={About} />
        <Route path="/founders" component={Founders} />
        <Route path="/technology" component={Technology} />
        <Route path="/business-management" component={BusinessManagement} />
        <Route path="/pages/:slug" component={CustomPortalPage} />
        <Route path="/admin/integrations"><RequireAdmin><AdminSettings /></RequireAdmin></Route>
        <Route path="/admin/access-pages"><RequireAdmin><AccessPages /></RequireAdmin></Route>
        <Route path="/admin/backups"><RequireAdmin><BackupCenter /></RequireAdmin></Route>
        <Route path="/admin/restores"><RequireAdmin><RestoreHistory /></RequireAdmin></Route>
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
