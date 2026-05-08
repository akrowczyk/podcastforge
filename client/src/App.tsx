import { useEffect } from "react";
import { Route, Routes, NavLink, Link } from "react-router-dom";
import SourceScreen from "./routes/SourceScreen";
import EditorScreen from "./routes/EditorScreen";
import RenderScreen from "./routes/RenderScreen";
import HealthBadge from "./components/HealthBadge";
import { useProject } from "./store/projectStore";

export default function App() {
  const { theme } = useProject();

  useEffect(() => {
    if (theme === "light") {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
  }, [theme]);

  return (
    <div className="min-h-screen bg-ink-950 text-ink-50 flex flex-col">
      <Header />
      <main className="flex-1 flex flex-col">
        <Routes>
          <Route path="/" element={<SourceScreen />} />
          <Route path="/editor" element={<EditorScreen />} />
          <Route path="/render" element={<RenderScreen />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  const { theme, toggleTheme } = useProject();
  return (
    <header className="border-b border-ink-800 bg-ink-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <Logo />
          <div className="leading-tight">
            <div className="font-display font-bold tracking-tightest text-lg">
              PODCASTFORGE
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              powered by grok
            </div>
          </div>
        </Link>
        <nav className="flex items-center gap-1">
          <Tab to="/" label="01 · Source" />
          <Tab to="/editor" label="02 · Script" />
          <Tab to="/render" label="03 · Render" />
        </nav>
        <div className="flex items-center gap-4">
          <button
            onClick={toggleTheme}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-ink-900 border border-ink-800 text-ink-400 hover:text-ink-50 transition-colors"
            title="Toggle theme"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <HealthBadge />
        </div>
      </div>
    </header>
  );
}

function Tab({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        [
          "px-4 py-2 font-mono text-xs uppercase tracking-widest transition-colors",
          isActive
            ? "text-ink-50 bg-ink-900 border border-ink-700"
            : "text-ink-500 hover:text-ink-200 border border-transparent",
        ].join(" ")
      }
    >
      {label}
    </NavLink>
  );
}

function Logo() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="w-7 h-7 transition-transform group-hover:rotate-[-3deg]"
      aria-hidden
    >
      <rect x="6" y="8" width="2" height="16" fill="currentColor" />
      <rect x="11" y="4" width="2" height="24" fill="currentColor" />
      <rect x="16" y="10" width="2" height="12" fill="currentColor" />
      <rect x="21" y="6" width="2" height="20" fill="currentColor" />
      <rect x="26" y="12" width="2" height="8" fill="currentColor" />
    </svg>
  );
}

function Footer() {
  return (
    <footer className="border-t border-ink-800 mt-auto">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-4 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.18em] text-ink-500">
        <div>PodcastForge / v0.1.0</div>
        <div className="flex items-center gap-4">
          <span>xAI · Grok TTS · 4.20/M chars</span>
          <span className="text-ink-700">/</span>
          <span>BLACK BOX BUILD</span>
        </div>
      </div>
    </footer>
  );
}
