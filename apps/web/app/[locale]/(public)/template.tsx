/*
 * Transição entre páginas públicas.
 *
 * `template.tsx` remonta a cada navegação (ao contrário de `layout.tsx`), e
 * elemento novo é o gatilho de `@starting-style`: o conteúdo entra com um
 * fade curto em vez de trocar de um quadro para o outro.
 *
 * O efeito de a foto do card virar o topo da página do programa precisaria
 * da View Transitions API em navegação client-side, que no Next hoje só
 * existe atrás de `experimental.viewTransition`. Num app que já está em
 * produção com cliente, não vale ligar flag experimental por causa de
 * transição visual.
 */
export default function PublicTemplate({ children }: { children: React.ReactNode }) {
  return <div className="fx-page">{children}</div>;
}
