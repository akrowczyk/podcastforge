import { useNavigate } from "react-router-dom";

export default function NotFoundScreen() {
  const nav = useNavigate();
  return (
    <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-20 w-full text-center animate-fade-up">
      <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink-500 mb-3">
        / 404 — route not found
      </div>
      <h1 className="font-display font-black text-display-xl text-ink-50 tracking-tightest leading-none">
        404
      </h1>
      <p className="text-ink-400 mt-6 mb-10 max-w-md mx-auto">
        That URL doesn't match any screen in PodcastForge. Head back to the
        Source intake to start a new project.
      </p>
      <button
        onClick={() => nav("/")}
        className="bg-ink-50 text-ink-950 px-8 py-3 font-display font-bold uppercase tracking-tight hover:bg-ink-200 transition-colors"
      >
        ← Back to Source
      </button>
    </div>
  );
}
