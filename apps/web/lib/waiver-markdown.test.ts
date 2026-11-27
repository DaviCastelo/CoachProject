import { describe, expect, it } from 'vitest';
import { parseWaiverMarkdown } from './waiver-markdown';

describe('parseWaiverMarkdown', () => {
  it('tira o "#" do título e separa os parágrafos', () => {
    expect(parseWaiverMarkdown('# Liability Waiver\n\nI agree.\nAll of it.\n\nSecond.')).toEqual([
      { kind: 'heading', level: 1, text: 'Liability Waiver' },
      { kind: 'paragraph', text: 'I agree. All of it.' },
      { kind: 'paragraph', text: 'Second.' },
    ]);
  });

  it('junta itens seguidos numa lista só, com hífen, asterisco ou número', () => {
    expect(parseWaiverMarkdown('Rules:\n- One\n* Two\n3. Three\nAfter.')).toEqual([
      { kind: 'paragraph', text: 'Rules:' },
      { kind: 'list', items: ['One', 'Two', 'Three'] },
      { kind: 'paragraph', text: 'After.' },
    ]);
  });

  it('aceita quebra de linha do Windows', () => {
    expect(parseWaiverMarkdown('## Medical\r\nText')).toEqual([
      { kind: 'heading', level: 2, text: 'Medical' },
      { kind: 'paragraph', text: 'Text' },
    ]);
  });

  it('texto sem marcação continua um parágrafo', () => {
    expect(parseWaiverMarkdown('Plain text')).toEqual([{ kind: 'paragraph', text: 'Plain text' }]);
  });
});
