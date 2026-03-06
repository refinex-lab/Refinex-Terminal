import { useEffect, useRef, useState } from 'react';

let mermaidInitialized = false;
let diagramCounter = 0;

export function MermaidBlock({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [diagramId] = useState(() => `mermaid-diagram-${++diagramCounter}-${Date.now()}`);

  useEffect(() => {
    (async () => {
      try {
        if (!mermaidInitialized) {
          const mermaid = await import('mermaid');
          await mermaid.default.initialize({
            startOnLoad: false,
            theme: 'dark'
          });
          mermaidInitialized = true;
        }

        const mermaid = await import('mermaid');
        const { svg } = await mermaid.default.render(
          diagramId,
          chart
        );

        if (ref.current) {
          ref.current.innerHTML = svg;
        }
      } catch (err) {
        setError(String(err));
      }
    })();
  }, [chart, diagramId]);

  if (error) {
    // Don't render anything if there's an error - fail silently
    return null;
  }

  return <div ref={ref} className="mermaid-container" />;
}
