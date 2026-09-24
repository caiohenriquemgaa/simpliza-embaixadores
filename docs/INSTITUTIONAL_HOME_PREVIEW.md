# Home institucional — Preview

## Escopo e auditoria

- Branch: `feature/institutional-home-chatgpt-ads`. A `main` remota foi incorporada **à branch**, preservando os patches de consentimento, fila e CSP do Meta Pixel. Nenhum merge na `main` nem deploy de produção foi realizado.
- `/` antes consultava Felipe. Agora renderiza `LandingTemplate` sem embaixador; `/inicio` reexporta a mesma página e metadata. Não existe registro de embaixador fictício.
- Hero institucional usa `/product/mockup-simpliza.webp`. Preservados template, identidade Work Sans, cores oficiais, formulário, fluxo de operação, delivery e simulador.
- Cards levam a `#gestao`, `#operacao`, `#delivery`, `#migracao`; `#simulador`, `#formulario` e a âncora legada `#contato` continuam disponíveis. Migração recebeu apenas um bloco de orientação e CTA, sem promessas comerciais novas.
- Os atalhos `/felipe` e `/diegogirao` continuam redirecionando às rotas canônicas `/embaixadores/...`, agora preservando todos os parâmetros de query.
- Confirmado via HTTP antes da correção: Diego tinha o título “Indicação do Felipe”. A metadata agora trata esse default copiado, mantendo metadata personalizada válida e usando nome real do registro para o fallback.
- Canonical e sitemap passam a usar o domínio público observado deste projeto, `https://www.embaixadorsimpliza.com.br`, em vez do domínio corporativo que não hospeda estas rotas. `/inicio` tem canonical `/` e não duplica a entrada no sitemap. Nenhuma configuração de domínio foi alterada.

## Atribuição e conversões

- `lib/attribution.ts`: first touch em `sessionStorage`, chave versionada `simpliza_attribution_v1`, fallback em memória quando storage está indisponível. O first touch não muda durante a sessão; intenção válida mais recente e touch do envio ficam separados.
- Registra landing inicial, referrer sem query, UTMs e parâmetros recebidos, com nomes originais. Limites: 24 parâmetros, chave de 80 caracteres, valor de 200 caracteres e orçamento total de 1.200 caracteres. Exclui nomes comuns de secrets/PII e parâmetros internos `_vercel`.
- Não há nome proprietário presumido para identificador de clique da OpenAI. Parâmetros de campanha, grupo, anúncio ou clique não sensíveis são preservados com o nome recebido. Fragmentos não integram a landing inicial.
- A API valida origem e caminho do envio, identidade do embaixador no banco, atribuição da mesma origem, tamanho real do body, consentimento, telefone e idempotência. Antispam não retorna mais um falso sucesso.
- `source_type=ambassador` usa slug/nome/campanha conferidos no banco. `source_type=institutional` não aceita campos de embaixador. `source_name=chatgpt_ads` requer `utm_source=chatgpt&utm_medium=paid_ai`; demais fontes usam UTM, referral ou direct.
- UTMs de aquisição são persistidas nas colunas existentes; `attribution` guarda first touch, touch do envio, intenção e contexto preparado de CRM.
- `lib/conversion.ts` é o único ponto de sucesso: exige `ok` e `leadId` da API, deduplica pelo ID e mantém **um** `generate_lead` no dataLayer. Meta `Lead` usa o helper original com consentimento. O evento DOM `simpliza:lead_submitted` é um ponto de integração, não uma segunda conversão GA4. Não cadastrar ambos como conversão no mesmo destino.
- Falha de tracking não reclassifica um lead aceito como erro do formulário. Não são enviados nome, telefone ou e-mail aos eventos.

## Banco e segurança do Preview

Migration criada: `supabase/migrations/202609230001_institutional_lead_attribution.sql`.

- Torna `ambassador_id` opcional para origem institucional; mantém FK e exige ID para embaixadores.
- Adiciona `source_type` com default legado, `source_name`, `intent`, `attribution` e índice de aquisição.
- Não apaga, renomeia nem reescreve dados. Inserts legados continuam válidos.
- **Aplicada na continuação autorizada** ao projeto atual `spmmdhpbdpqqxrukyygj` (LP Embaixadores Simpliza). Schema, constraints, triggers e função da fila CRM foram conferidos antes. Apenas esta migration estava pendente; aplicação transacional com limites de lock de 5s e execução de 30s. Nenhuma troca de banco.
- Preview bloqueia inserções com HTTP 503 por padrão. A continuação autorizou gravação controlada no banco atual; `LEADS_PREVIEW_WRITES_ENABLED=true` foi configurada exclusivamente no Preview da branch `feature/institutional-home-chatgpt-ads`. Nenhuma variável de Production foi alterada.
- Todos os registros de Preview ficam `crm_status=ignored`; o módulo Data Crazy também força integração desativada em `VERCEL_ENV=preview`, inclusive cron/retry.
- Antes de futura publicação, a migration precisa estar aplicada no banco de destino. Esta missão não autoriza essa publicação.

## Data Crazy

- A integração dos embaixadores foi preservada: campos, tags, deduplicação e pipeline existentes.
- `lib/datacrazy/institutional.ts` prepara contexto com `ChatGPT Ads — Gestão / Operação / Delivery / Migração` ou `Institucional — fonte`, além dos dois touches e intenção. Esse contexto fica no JSON do lead.
- Leads institucionais ficam `ignored`, aguardando definição do pipeline/stage, tags e IDs de campos do destino institucional. Não foram criados metadados nem enviadas solicitações de lead ao Data Crazy.
- Não ativar retries institucionais no adaptador legado. A futura ativação deve mapear o contexto preparado aos campos confirmados e liberar a fila somente após configuração aprovada.

## ChatGPT Ads: configuração externa pendente

Preparado: URLs com intenção e UTMs, captura genérica de identificadores, persistência e hook após aceitação real. Não há integração de conversão OpenAI ativa.

Para ativar: obter a especificação oficial da integração disponível na conta, nomes reais dos parâmetros de clique, conversion source/event ID e Pixel ID ou credencial server-side caso esse mecanismo seja exigido; configurar o destino e consentimento, sem segredo no cliente, e validar uma conversão de teste autorizada. Nenhum pixel/API proprietário foi inventado. O GA4/GTM também depende do container/propriedade da conta; esta alteração preserva o contrato `generate_lead` existente.

## Preços preservados

Valores mensais / anual equivalente por mês do simulador: Start 149/99; Essencial 229/185; Gestão 319/250; Profissional 439/350; Corporativo 525/420. Implantação e demais condições também foram preservadas. A vigência comercial não foi revalidada.

## Verificação

- Workflow `.github/workflows/institutional-preview.yml` executa remotamente lint, TypeScript, suíte existente e builds vinext/Next, mais testes de atribuição e API.
- API testada com dependências simuladas: aceitação, persistência de first touch e contexto institucional, identidade legada, falha de banco, idempotência, origem/caminho inválidos, tamanho real do body, antispam e bloqueio de Preview. Nenhum teste acessa um CRM real.
- Browser: home institucional, `/inicio`, destaque Delivery, âncoras e first touch preservado após navegação. Formulário real de Preview retorna bloqueio controlado, sem `generate_lead`.
- A gravação real foi confirmada na continuação autorizada abaixo; os testes simulados anteriores permanecem distintos dessa evidência externa.

## Validação real — continuação de 23/09/2026 (BRT)

- Projeto Supabase confirmado por CLI e pelo `connect-src` da Preview: `spmmdhpbdpqqxrukyygj`, “LP Embaixadores Simpliza”. Vercel: `prj_XUD43dFVpU7D5KorbzGdS2oAoj3V`.
- Migration `202609230001` aplicada via CLI e confirmada no histórico remoto. As quatro migrations anteriores já estavam aplicadas. Nenhum seed/reset executado.
- Os 19 registros anteriores mantiveram o fingerprint dos campos legados `1c3b7c45215e259394a42bebf7b06689` antes/depois da migration e depois do teste; nenhum dado histórico foi modificado.
- Enviado exatamente **um** formulário real, sem mock, na Preview `https://simpliza-embaixadores-gkqdvhkp8-simpliza.vercel.app/`.
- Registro de teste: `372e355e-9d1c-4b21-8135-8685fc9eff63`, criado em `2026-09-24T02:08:42.900461Z` (23/09, 23:08 BRT), nome “Teste ChatGPT Ads Simpliza”, estabelecimento “Restaurante Teste ChatGPT”. Telefone fictício com assinante zerado e e-mail `.invalid`; nenhum contato real.
- Confirmados por consulta direta: nome, estabelecimento, telefone e normalização, e-mail, cidade, faturamento, preferência `email`, consentimento e timestamp; `ambassador_id/name/slug=null`.
- Confirmados: `source_type=institutional`, `source_name=chatgpt_ads`, `intent=delivery`, `utm_source=chatgpt`, `utm_medium=paid_ai`, `utm_campaign=br_aquisicao_intencao_simpliza`, `utm_content=teste_integracao`, `utm_term=null` (ausente na entrada).
- Confirmados `source_page=/`, URL completa de origem, `firstTouch`, `conversionTouch`, parâmetros, timestamps e `crmContext.source=ChatGPT Ads — Delivery`. Referrer vazio porque o acesso foi direto à URL de teste; nenhum identificador proprietário foi inventado.
- Evidência de conversão observada sem substituir resposta da API: requisição com zero conversões → HTTP 201 com o ID real acima → um `generate_lead` no dataLayer → um evento DOM `simpliza:lead_submitted`, com o mesmo ID. Clique anterior em formulário inválido: zero requisições e zero conversões. Consentimento Meta recusado durante o teste, evitando conversão de teste nessa plataforma.
- CRM: `crm_status=ignored`, `crm_attempts=0`, IDs Data Crazy, tentativa e data de sincronização nulos. Função `claim_lead_for_crm` conferida no banco: somente `pending`, `failed` e `processing` vencidos são elegíveis. Nenhum envio ao Data Crazy.
- Nenhum código visual foi alterado na continuação. Nenhum merge na main, deploy de Production ou mudança de domínio. A alteração no schema compartilhado foi explicitamente autorizada pelo usuário.
