/*
 * O texto do waiver é cadastrado em Markdown (`waiver_templates.body_markdown`)
 * e aparecia cru para a família, com "#" no título e "**" no meio do texto.
 *
 * Cobre só o que um termo usa: títulos, listas, parágrafos e negrito. Quem
 * desenha é `components/forms/waiver-body.tsx`, com elementos React: nada do
 * texto vira HTML de verdade.
 */
export type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'paragraph'; text: string };

export function parseWaiverMarkdown(markdown: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: string[] | null = null;

  const flush = () => {
    if (paragraph.length) blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
    if (list) blocks.push({ kind: 'list', items: list });
    paragraph = [];
    list = null;
  };

  for (const raw of markdown.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    const bullet = /^(?:[-*•]|\d+[.)])\s+(.*)$/.exec(line);

    if (!line) {
      flush();
    } else if (heading) {
      flush();
      blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2] });
    } else if (bullet) {
      if (paragraph.length) {
        blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
        paragraph = [];
      }
      list = [...(list ?? []), bullet[1]];
    } else {
      if (list) {
        blocks.push({ kind: 'list', items: list });
        list = null;
      }
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}
