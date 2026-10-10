import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/*
 * Testes de unidade do app.
 *
 * O `apps/web` ficou sem runner até aqui, e isso cobrou o preço: dois bugs
 * sérios no módulo de cobrança foram achados a olho, não por teste. O mapa de
 * status do ACH e a conferência de moeda são funções pequenas que decidem se
 * uma vaga é liberada e quanto o clube recebeu.
 *
 * O escopo é deliberadamente estreito: só `lib/`, que é onde mora a lógica
 * sem React. Teste de componente e de página é outro assunto, e o Playwright
 * já cobre o caminho pelo navegador.
 */

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@ca-tempo/domain': r('../../packages/domain/src/index.ts'),
      '@ca-tempo/db': r('../../packages/db/src/index.ts'),
      '@': r('./'),
    },
  },
  test: {
    include: ['lib/**/*.test.ts'],
    environment: 'node',
  },
});
