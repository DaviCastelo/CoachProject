import * as React from 'react';
import { parseWaiverMarkdown } from '@/lib/waiver-markdown';

/** Negrito (`**texto**`) dentro de uma linha. */
function Inline({ text }: Readonly<{ text: string }>) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={i} className="font-semibold text-foreground">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  );
}

/** Texto do waiver formatado: as regras de leitura estão em `lib/waiver-markdown.ts`. */
export function WaiverBody({ markdown }: Readonly<{ markdown: string }>) {
  const blocks = parseWaiverMarkdown(markdown);
  return (
    <div className="space-y-3 leading-relaxed text-muted-foreground">
      {blocks.map((block, i) => {
        if (block.kind === 'heading') {
          return block.level === 1 ? (
            <p key={i} className="font-display text-lg uppercase tracking-wide text-foreground">
              <Inline text={block.text} />
            </p>
          ) : (
            <p key={i} className="pt-1 font-semibold text-foreground">
              <Inline text={block.text} />
            </p>
          );
        }
        if (block.kind === 'list') {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {block.items.map((item, j) => (
                <li key={j}>
                  <Inline text={item} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            <Inline text={block.text} />
          </p>
        );
      })}
    </div>
  );
}
