import { useMemo } from "react";
import * as Icons from "lucide-react";
import type { Feature } from "./admin/FeatureGridExtension";

type AnyIconRecord = Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>>;

function LucideIcon({ name }: { name: string }) {
  const Comp = (Icons as unknown as AnyIconRecord)[name];
  return Comp ? <Comp className="w-6 h-6 text-copper" strokeWidth={1.75} /> : <Icons.Star className="w-6 h-6 text-copper" strokeWidth={1.75} />;
}

function FeatureGrid({ features }: { features: Feature[] }) {
  if (!features.length) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
      {features.map((f, i) => (
        <div key={i} className="flex gap-4 p-5 bg-[#faf7f4] rounded-2xl">
          <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-[#ede5db] rounded-full">
            <LucideIcon name={f.icon} />
          </div>
          <div className="min-w-0">
            <p className="text-base font-bold text-navy leading-snug">{f.title}</p>
            {f.desc && <p className="text-sm text-navy/60 mt-1 leading-relaxed">{f.desc}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

type Part =
  | { type: "html"; content: string }
  | { type: "features"; features: Feature[] };

function parseRichHtml(html: string): Part[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const parts: Part[] = [];
  let htmlBuf = "";

  doc.body.childNodes.forEach((node) => {
    const el = node as Element;
    if (el.getAttribute && el.getAttribute("data-type") === "feature-grid") {
      if (htmlBuf) { parts.push({ type: "html", content: htmlBuf }); htmlBuf = ""; }
      try {
        const features: Feature[] = JSON.parse(el.getAttribute("data-features") || "[]");
        parts.push({ type: "features", features });
      } catch {
        /* skip malformed */
      }
    } else {
      htmlBuf += (el.outerHTML ?? el.textContent ?? "");
    }
  });

  if (htmlBuf) parts.push({ type: "html", content: htmlBuf });
  return parts;
}

interface Props {
  html: string;
  className?: string;
}

export function RichDescription({ html, className }: Props) {
  const parts = useMemo(() => parseRichHtml(html), [html]);

  return (
    <div className={className}>
      {parts.map((part, i) =>
        part.type === "features" ? (
          <FeatureGrid key={i} features={part.features} />
        ) : (
          <div
            key={i}
            className="prose prose-sm max-w-none text-navy/70 leading-relaxed
              [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-navy [&_h1]:mt-4 [&_h1]:mb-2
              [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-navy [&_h2]:mt-3 [&_h2]:mb-1
              [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-navy [&_h3]:mt-2 [&_h3]:mb-1
              [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5
              [&_li]:my-0.5 [&_a]:text-copper [&_a]:underline
              [&_img]:rounded-lg [&_img]:max-w-full [&_img]:my-2
              [&_hr]:border-navy/20 [&_hr]:my-3
              [&_iframe]:rounded-lg [&_iframe]:max-w-full [&_iframe]:my-2"
            dangerouslySetInnerHTML={{ __html: part.content }}
          />
        )
      )}
    </div>
  );
}
