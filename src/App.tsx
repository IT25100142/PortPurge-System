
function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-2xl text-center space-y-6">
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
          PortPurge
        </h1>
        <p className="text-slate-400 text-sm">
          Lightweight, modern localhost port manager and process terminator.
        </p>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          Phase 1 Environment Ready
        </div>
      </div>
    </div>
  );
}

export default App;
