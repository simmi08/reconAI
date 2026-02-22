export function JsonViewer({ data }: { data: unknown }) {
  return (
    <pre className="max-h-[460px] overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
