import {
  Activity,
  BookOpen,
  FileStack,
  FolderOpen,
  LayoutDashboard,
  ListChecks,
  MessagesSquare,
  Sprout,
  Tags,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { api } from "./api";
import SearchBox from "./components/SearchBox";
import AuditPage from "./pages/AuditPage";
import DocumentDetailPage from "./pages/DocumentDetailPage";
import DocumentsPage from "./pages/DocumentsPage";
import HomePage from "./pages/HomePage";
import KnowledgeDetailPage from "./pages/KnowledgeDetailPage";
import KnowledgePage from "./pages/KnowledgePage";
import QaPage from "./pages/QaPage";
import ReviewPage from "./pages/ReviewPage";
import ReviewQueuePage from "./pages/ReviewQueuePage";
import TaxonomyPage from "./pages/TaxonomyPage";

type NavItem = {
  to?: string;
  label?: string;
  icon?: typeof LayoutDashboard;
  end?: boolean;
  badge?: boolean;
  locked?: boolean;
  group?: string;
};

const links: NavItem[] = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { group: "Knowledge" },
  { to: "/documents", label: "Documents", icon: FolderOpen },
  { to: "/review", label: "Review", icon: ListChecks, badge: true },
  { to: "/knowledge", label: "Knowledge", icon: BookOpen },
  { group: "DDQ" },
  { locked: true, label: "Questions", icon: MessagesSquare },
  { group: "Manage" },
  { to: "/taxonomy", label: "Taxonomy", icon: Tags },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/qa", label: "Approved Q&A", icon: FileStack },
];

function crumb(path: string) {
  if (path.startsWith("/documents") && path.includes("/review")) return "Review workspace";
  if (path.startsWith("/documents/")) return "Document";
  if (path.startsWith("/knowledge/")) return "Knowledge item";
  const map: Record<string, string> = {
    "/": "Overview",
    "/documents": "Documents",
    "/review": "Review queue",
    "/knowledge": "Knowledge",
    "/taxonomy": "Taxonomy",
    "/activity": "Activity",
    "/qa": "Approved Q&A",
  };
  return map[path] || "ESG Knowledge";
}

export default function App() {
  const [proposed, setProposed] = useState(0);
  const reviewer = localStorage.getItem("esg-reviewer") || "Noel";
  const location = useLocation();
  const wide = location.pathname.includes("/review") && location.pathname.startsWith("/documents");

  useEffect(() => {
    api.overview().then((data) => setProposed(data.proposed)).catch(() => undefined);
  }, []);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="mark"><Sprout size={16} strokeWidth={1.6} /></span>
          <div>
            <small>Workspace</small>
            <strong>Savills IM</strong>
          </div>
        </div>
        <nav className="nav">
          {links.map((item, index) => {
            if (item.group) return <div className="nav-label" key={item.group}>{item.group}</div>;
            const Icon = item.icon!;
            if (item.locked) {
              return (
                <span className="locked" key={`locked-${index}`}>
                  <Icon className="nav-ico" strokeWidth={1.6} />
                  <span className="label">{item.label}</span>
                  <span className="faint">Phase 2</span>
                </span>
              );
            }
            return (
              <NavLink key={item.to} to={item.to!} end={item.end} className={({ isActive }) => (isActive ? "active" : "")}>
                <Icon className="nav-ico" strokeWidth={1.6} />
                <span className="label">{item.label}</span>
                {item.badge && proposed > 0 && <span className="badge-count">{proposed}</span>}
              </NavLink>
            );
          })}
        </nav>
      </aside>
      <div className="shell">
        {!wide && (
          <header className="topbar">
            <span className="muted">ESG Knowledge / {crumb(location.pathname)}</span>
            <SearchBox compact />
            <div className="who">
              <span>{reviewer}</span>
              <span className="avatar">{reviewer.slice(0, 1)}</span>
            </div>
          </header>
        )}
        <Routes>
          <Route path="/" element={<main className="main"><HomePage /></main>} />
          <Route path="/documents" element={<main className="main"><DocumentsPage /></main>} />
          <Route path="/documents/:id" element={<main className="main"><DocumentDetailPage /></main>} />
          <Route path="/documents/:id/review" element={<main className="main wide"><ReviewPage /></main>} />
          <Route path="/review" element={<main className="main"><ReviewQueuePage /></main>} />
          <Route path="/knowledge" element={<main className="main"><KnowledgePage /></main>} />
          <Route path="/knowledge/:id" element={<main className="main"><KnowledgeDetailPage /></main>} />
          <Route path="/taxonomy" element={<main className="main"><TaxonomyPage /></main>} />
          <Route path="/activity" element={<main className="main"><AuditPage /></main>} />
          <Route path="/qa" element={<main className="main"><QaPage /></main>} />
        </Routes>
      </div>
    </div>
  );
}
