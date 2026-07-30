# 08 — Segurança e Compliance

Este produto guarda nome, foto, data de nascimento, endereço, condição médica e localização em tempo real de **crianças**. Isso muda a régua: um incidente aqui não é um vazamento de e-mails, é um problema sério para as famílias e potencialmente o fim do negócio da CA Tempo.

Nenhuma parte deste documento é opcional.

---

## 1. Modelo de ameaças

| Ameaça | Probabilidade | Impacto | Controle |
|--------|---------------|---------|----------|
| Pai enxerga dados de filhos de outras famílias | Média (bug comum) | **Crítico** | RLS como camada primária + testes pgTAP obrigatórios |
| Coach demitido mantém acesso | Média | Alto | Revogação imediata de membership; sessão invalidada |
| Conta de admin comprometida | Baixa | **Crítico** | MFA obrigatório para owner/admin; log de auditoria |
| `service_role` key vazada no bundle do cliente | Baixa | **Crítico** | Lint que bloqueia import de `supabase/admin` fora de `app/api` e actions; scan de segredo no CI |
| Foto de menor exposta publicamente | Média | **Crítico** | Storage privado com URL assinada de curta duração; flag `photo_consent` respeitado em toda query |
| Enumeração de atletas por ID sequencial | Baixa | Médio | UUID em todas as chaves primárias |
| Cancelamento de sessão em massa por engano ou má-fé | Baixa | Alto | Confirmação com contagem explícita + log + janela de desfazer |
| Injeção via campo de formulário livre | Baixa | Alto | Queries parametrizadas; sanitização de HTML; CSP restritiva |
| Reenvio de webhook forjado | Baixa | Alto | Verificação de assinatura + idempotência |
| Dado de cartão em log | Baixa | **Crítico** | Nunca tocamos em cartão; Stripe hospedado; redação de PII no Sentry |

---

## 2. Autenticação e sessão

- **Magic link** como método padrão (Supabase Auth). Sem senha para esquecer ou reutilizar.
- **OAuth Google e Apple** como atalho.
- **MFA por TOTP obrigatório** para papéis `owner` e `admin` — são as contas que veem dados financeiros e contatos de toda a base.
- Sessão de 30 dias com refresh; 8 horas para admin.
- Logout invalida o refresh token em todos os dispositivos.
- Rate limiting no envio de magic link (5 por hora por e-mail) para evitar abuso de caixa de entrada.
- Convite de usuário expira em 7 dias.
- Ao remover uma `membership`, todas as sessões daquele usuário naquela organização são invalidadas na hora.

---

## 3. Autorização

A decisão está detalhada em [docs/03 § 13](03-modelo-de-dados.md#13-row-level-security). Em resumo, três camadas independentes:

1. **RLS no Postgres** — a autoridade final. Mesmo que a aplicação erre, o banco não devolve a linha.
2. **Guards de rota** nos layouts do Next.js — impedem que a pessoa chegue à tela errada.
3. **Validação nas Server Actions** — toda mutação revalida o papel antes de executar.

### Regra inegociável
> Nenhuma tabela vai para produção sem RLS habilitado e sem um teste pgTAP que prove o isolamento.

O CI falha se uma migration criar tabela sem `enable row level security`. Isso é verificado por um script que roda contra o banco de staging após cada `db push`.

### Uso da `service_role`
Apenas três lugares, todos server-side:
- Route Handlers de webhook (`app/api/webhooks/*`)
- Jobs de cron (`app/api/cron/*`, protegidos por `CRON_SECRET`)
- Scripts de migração de dados (`supabase/seed/`)

Uma regra de lint bloqueia a importação do cliente admin fora desses caminhos, e o CI roda `gitleaks` para impedir que a chave entre no repositório.

---

## 4. Dados de menores

### O que a lei exige

**COPPA** (Children's Online Privacy Protection Act) se aplica a serviços online que coletam dados pessoais de crianças **menores de 13 anos**. Na arquitetura que estamos construindo, quem cria a conta e fornece os dados é o **responsável legal**, não a criança — o que é justamente a forma de consentimento parental verificável que a lei prevê. Duas consequências de projeto:

1. **Atleta menor de 13 anos não tem login próprio.** O acesso é do responsável. O campo `athletes.user_id` permanece nulo.
2. **Atleta de 13 anos ou mais** pode ter login, mas apenas se o responsável habilitar explicitamente, e o consentimento fica registrado com data, hora e IP.

**FERPA** não se aplica (não somos instituição de ensino que recebe verba federal). **HIPAA** não se aplica (não somos prestador de saúde) — mas as notas médicas em `athletes.medical_notes` merecem tratamento equivalente por prudência, com acesso restrito a staff e log de leitura.

**Privacidade estadual (Flórida, Califórnia/CCPA e afins):** direito de acesso, correção e exclusão dos dados. Implementamos exportação e exclusão self-service para não depender de processo manual.

> **Aviso:** este documento é orientação de engenharia, não parecer jurídico. Antes do lançamento, a CA Tempo deve ter os termos de uso, a política de privacidade e o texto do waiver revisados por um advogado licenciado no estado onde opera.

### Controles implementados

| Controle | Como |
|----------|------|
| Consentimento parental registrado | `waiver_signatures` com IP, user agent, timestamp e hash |
| Consentimento de imagem separado | `athletes.photo_consent`, respeitado em toda query de mídia |
| Consentimento para tratamento médico de emergência | `athletes.medical_treatment_consent` |
| Minimização de dados | Coletamos apenas o que a operação exige; sem SSN, sem dado bancário da família |
| Notas médicas com acesso restrito | Só staff; leitura registrada no `audit_log` |
| Fotos em storage privado | URL assinada com validade de 60 minutos; nunca bucket público |
| Retenção | Atleta inativo por 3 anos → anonimização automática, exceto registros fiscais |
| Exclusão a pedido | Exportação e anonimização self-service no portal da família |
| Sem venda ou compartilhamento de dados | Escrito na política e verdadeiro na arquitetura |

### Anonimização em vez de exclusão física
Quando uma família pede exclusão, apagar a linha quebraria o histórico financeiro (que precisa ser mantido por obrigação fiscal). A implementação substitui nome, e-mail, telefone, foto e notas por marcadores, mantendo a integridade referencial e os valores agregados. O `audit_log` registra quem pediu, quando e o que foi anonimizado.

---

## 5. Waiver com validade legal

Assinatura eletrônica nos EUA é regida pelo **ESIGN Act** (federal) e pela **UETA** (estadual). Uma assinatura eletrônica é válida quando há:

| Requisito legal | Nossa implementação |
|-----------------|---------------------|
| Intenção de assinar | Ação afirmativa: desenhar ou digitar o nome e clicar em "Concordo e assino" |
| Consentimento ao meio eletrônico | Checkbox explícito, com aviso de que é possível solicitar via papel; gravado em `consent_to_electronic_signature` |
| Associação da assinatura ao documento | `document_hash` — SHA-256 do texto exato exibido na tela |
| Atribuição ao signatário | Nome, e-mail, parentesco, IP, user agent e timestamp |
| Retenção e reprodução | PDF imutável no Storage, com a assinatura, o texto e a trilha de auditoria embutidos |

### Por que o hash é o detalhe que importa
Guardar "Maria Silva assinou o waiver em 28/07/2026" não tem valor probatório se o texto do waiver puder ser editado depois. Guardamos o SHA-256 do documento renderizado. Se houver disputa, é possível provar exatamente qual texto estava na tela naquele momento. Além disso, `waiver_templates` é versionado e cada assinatura aponta para uma versão imutável.

### Ciclo de vida
Waiver tem `expires_on` (tipicamente o fim da temporada). O sistema alerta 30 dias antes e bloqueia a participação em sessões quando expira — com um aviso claro no roster do coach (`waiver_valid: false` na view `session_roster`), não com uma surpresa no dia do treino.

### Migração dos waivers do JotForm
Os waivers históricos não têm a mesma trilha de auditoria. Importamos como registro histórico com `signature_type = 'imported'` e recomendamos formalmente **recoletar todos os waivers na plataforma nova no início da próxima temporada**.

---

## 6. PCI DSS

Nunca tocamos em dado de cartão. Stripe Checkout (página hospedada) ou Elements (iframe isolado) mantêm o número do cartão fora do nosso domínio e do nosso servidor. Isso coloca a operação no escopo **SAQ A**, o mais leve: autoavaliação anual, sem auditoria e sem scan de vulnerabilidade obrigatório.

Regras derivadas:
- Nenhum campo de cartão renderizado por nós, nunca
- Nenhum número de cartão em log, em banco ou no Sentry
- Guardamos apenas os IDs opacos da Stripe (`payment_intent`, `charge`) e os últimos 4 dígitos, quando a Stripe os fornece

---

## 7. Segurança da aplicação

### Headers
```
Content-Security-Policy      restritiva, com nonce; sem unsafe-inline
Strict-Transport-Security    max-age=63072000; includeSubDomains; preload
X-Frame-Options              DENY
X-Content-Type-Options       nosniff
Referrer-Policy              strict-origin-when-cross-origin
Permissions-Policy           camera=(self), geolocation=(), microphone=()
```

### Entrada e saída
- Todo input validado com Zod na borda, antes de qualquer uso
- Queries sempre parametrizadas (o cliente Supabase e o PostgREST fazem isso por padrão)
- HTML de campo livre sanitizado com DOMPurify antes de renderizar
- Upload: validação de MIME real (não confiar na extensão), teto de tamanho, nome de arquivo gerado, sem execução

### Rate limiting
| Endpoint | Limite |
|----------|--------|
| Envio de magic link | 5/hora por e-mail |
| Submissão de formulário público | 10/hora por IP |
| Busca | 60/minuto por usuário |
| Webhooks | verificação de assinatura (sem limite de taxa) |
| Cron | header `CRON_SECRET` obrigatório |

### Dependências
`pnpm audit` no CI, Dependabot ativo, `gitleaks` para varredura de segredos, revisão manual de qualquer dependência nova com menos de 1.000 downloads semanais.

---

## 8. Observabilidade e resposta a incidente

### Monitoramento
Sentry para erros (com scrubbing de PII: e-mail, telefone e nome mascarados antes do envio), Vercel Analytics para Web Vitals, PostHog para produto (sem gravação de sessão nas telas com dado de menor), health check externo a cada 5 minutos.

### Alertas
| Condição | Ação |
|----------|------|
| Taxa de erro > 1% em 5 min | Notificação imediata ao desenvolvedor |
| Webhook de pagamento falhando | Notificação imediata |
| Falha de job de cron | Notificação em 15 min |
| Tentativa de acesso negada por RLS em volume anômalo | Investigação — pode indicar bug ou ataque |
| Login de admin de localização nova | E-mail de aviso ao próprio admin |

### Plano de resposta
1. **Contenção** — revogar sessões, desativar a funcionalidade afetada, ou colocar em modo leitura
2. **Avaliação** — o que vazou, de quantas pessoas, por quanto tempo
3. **Notificação** — se houver dado pessoal de menor exposto, notificar as famílias afetadas e verificar as obrigações de notificação de violação do estado
4. **Correção** — corrigir, adicionar teste de regressão, fazer deploy
5. **Post-mortem** — documento sem culpados no repositório

Contato de emergência e responsabilidades definidos na Fase 0.

---

## 9. Backup e continuidade

| Item | Estratégia |
|------|-----------|
| Banco de dados | PITR do Supabase (7 dias) + `pg_dump` diário para storage externo com retenção de 30 dias |
| Storage | Replicação do Supabase + snapshot semanal dos documentos críticos (waivers, faturas) |
| Restauração | Testada trimestralmente em ambiente descartável — backup não testado não é backup |
| RTO | 4 horas |
| RPO | 24 horas (1 hora com PITR) |
| Vídeo | Cloudflare Stream é a fonte; o arquivo original fica no Storage por 90 dias |
| Configuração | Tudo em código no repositório; ambiente recriável do zero |

### Portabilidade
Um requisito de contrato, não só técnico: a CA Tempo deve conseguir sair da plataforma com todos os seus dados. Um comando de export gera CSV de todas as tabelas e um ZIP com todos os documentos. Sem lock-in.

---

## 10. Checklist antes de cada entrega

Verificado e assinado antes de qualquer deploy de produção com dados reais:

- [ ] Toda tabela nova tem RLS habilitado
- [ ] Toda tabela nova tem teste pgTAP de isolamento passando
- [ ] Nenhum segredo no repositório (gitleaks limpo)
- [ ] `service_role` não aparece em nenhum bundle do cliente
- [ ] Headers de segurança ativos em produção (verificado no securityheaders.com)
- [ ] Sentry com scrubbing de PII configurado
- [ ] Backup restaurado com sucesso em ambiente de teste
- [ ] MFA ativo nas contas de owner e admin
- [ ] Bucket de fotos privado, com URL assinada
- [ ] Fluxo de waiver gera PDF com hash correto
- [ ] Webhook idempotente comprovado por teste
- [ ] `pnpm audit` sem vulnerabilidade alta ou crítica
- [ ] Política de privacidade e termos publicados e vigentes
- [ ] Exportação e exclusão de dados funcionando no portal da família
