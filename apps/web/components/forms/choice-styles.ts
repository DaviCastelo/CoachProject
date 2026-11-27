/*
 * Rádio e checkbox como cartão: a área inteira é clicável (dedo no celular
 * não acerta um círculo de 13px) e a opção marcada ganha a borda dourada.
 * `accent-color` pinta o controle nativo no dourado do site, no lugar do azul
 * do sistema.
 */
export const choiceCard =
  'flex cursor-pointer items-start gap-3 rounded-lg border border-input bg-background p-3 transition-colors hover:border-accent-500/60 has-[:checked]:border-accent-500 has-[:checked]:bg-accent-500/10 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring';

export const choiceInput = 'mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-accent-500';

/** Para cartão de uma linha, com o controle centralizado no texto. */
export const choiceInputCentered = 'h-4 w-4 shrink-0 cursor-pointer accent-accent-500';
