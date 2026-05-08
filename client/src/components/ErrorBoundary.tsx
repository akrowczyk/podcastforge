import { Component, type ErrorInfo, type ReactNode } from "react";
import { useProject } from "../store/projectStore";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// React 18 still requires class components for error boundaries.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface to the console for the dev experience; production builds
    // would typically wire this to a real error reporter.
    if (import.meta.env.DEV) {
      console.error("[ErrorBoundary]", error, info.componentStack);
    }
  }

  reset = () => {
    this.setState({ error: null });
  };

  resetProject = () => {
    useProject.getState().resetProject();
    this.setState({ error: null });
    location.replace("/");
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="max-w-[800px] mx-auto px-6 lg:px-10 py-20 w-full animate-fade-up">
        <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-red-400 mb-3">
          / Unhandled error
        </div>
        <h1 className="font-display font-black text-display-md text-ink-50 tracking-tightest mb-4">
          Something broke.
        </h1>
        <p className="text-ink-400 mb-6">
          An uncaught error stopped the app from rendering. The details are
          below. You can try resetting just this screen, or wipe the project
          state entirely if a corrupt store is the cause.
        </p>
        <pre className="font-mono text-[12px] text-red-200 bg-ink-900/60 border border-red-900/60 p-4 mb-6 max-h-64 overflow-auto whitespace-pre-wrap leading-relaxed">
          {this.state.error.name}: {this.state.error.message}
          {this.state.error.stack ? `\n\n${this.state.error.stack}` : ""}
        </pre>
        <div className="flex gap-3">
          <button
            onClick={this.reset}
            className="bg-ink-50 text-ink-950 px-6 py-3 font-display font-bold uppercase tracking-tight hover:bg-ink-200 transition-colors"
          >
            Try again
          </button>
          <button
            onClick={this.resetProject}
            className="border border-ink-700 text-ink-300 px-6 py-3 font-display font-bold uppercase tracking-tight hover:text-ink-50 hover:border-ink-50 transition-colors"
          >
            Reset project + reload
          </button>
        </div>
      </div>
    );
  }
}
