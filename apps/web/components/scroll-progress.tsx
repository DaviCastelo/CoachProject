/*
 * Barra dourada de progresso de leitura, presa no topo.
 *
 * Toda a lógica é CSS (`.fx-progress` + `animation-timeline: scroll()`), sem
 * listener de scroll: um `onScroll` em React para isso roda a cada quadro na
 * thread principal e é exatamente o tipo de coisa que faz a rolagem engasgar
 * em celular fraco.
 */
export function ScrollProgress() {
  return <div className="fx-progress" aria-hidden="true" />;
}
