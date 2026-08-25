# Simpliza — Programa de Embaixadores

Aplicação para criar e publicar landing pages individuais de embaixadores da Simpliza. O layout aprovado da LP original é compartilhado por todas as páginas e o conteúdo é gerenciado em um painel administrativo.

## Arquitetura

- Next.js 16 App Router. O build nativo (`npm run build:vercel`) é o alvo de publicação na Vercel; Vinext/Vite permanece disponível para o ambiente Cloudflare legado.
- React Server Components para entregar o conteúdo público no HTML inicial.
- Supabase PostgreSQL, Auth e Storage.
- Row Level Security: visitantes leem somente embaixadores publicados; somente usuários com `app_metadata.role = admin` administram conteúdo e leads.
- Uma única UI pública em `app/components/landing-template.tsx`.
- Rotas públicas em `/` e `/embaixadores/[slug]`.
- Painel em `/admin/login` e `/admin/embaixadores`.
- APIs administrativas usam o access token do usuário e mantêm a service role exclusivamente no servidor.

O D1/Drizzle do starter permanece no repositório apenas para compatibilidade com o ambiente Cloudflare existente; a aplicação do Programa de Embaixadores usa Supabase.

## Configuração oficial com o Supabase CLI

Requisitos: Node.js 22.13 ou superior e um projeto Supabase. O CLI está instalado como dependência de desenvolvimento e deve ser executado pelos scripts do npm ou com `npx supabase`.

### Variáveis de ambiente

Copie `.env.example` para `.env.local` e substitua os placeholders. O arquivo local é ignorado pelo Git.

| Variável | Onde encontrar | Exposição |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings/Connect → Project URL | Pública |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase Dashboard → Project Settings → API Keys → Publishable key | Pública |
| `SUPABASE_SECRET_KEY` | Supabase Dashboard → Project Settings → API Keys → Secret key | Somente servidor |
| `SUPABASE_PROJECT_REF` | Supabase Dashboard → Project Settings → General → Reference ID; também aparece na URL do projeto | Pública, usada pelo CLI |
| `NEXT_PUBLIC_SITE_URL` | URL local ou domínio canônico da aplicação | Pública |
| `NEXT_PUBLIC_GA4_ID` | Google Analytics, se usado | Pública e opcional |
| `NEXT_PUBLIC_META_PIXEL_ID` | Meta Events Manager, se usado | Pública e opcional |

Nenhuma chave secreta começa com `NEXT_PUBLIC_`. O projeto usa as chaves atuais `sb_publishable_...` e `sb_secret_...`; a antiga `SUPABASE_SERVICE_ROLE_KEY` não é usada. Placeholders `SUBSTITUA_AQUI_...` são tratados como configuração ausente, portanto não provocam conexão acidental.

As variáveis `CODEX_SANDBOX`, `WRANGLER_WRITE_LOGS`, `WRANGLER_LOG_PATH` e `MINIFLARE_REGISTRY_PATH` são controles operacionais do ambiente Vite/Cloudflare, definidos automaticamente pelos scripts ou pelo runtime. Elas não são credenciais Supabase e não precisam ser adicionadas ao `.env.local`.

### Fluxo de conexão e banco

1. Crie um projeto no [Supabase Dashboard](https://supabase.com/dashboard).
2. Copie `.env.example` para `.env.local` — este repositório já contém uma cópia apenas com placeholders.
3. Preencha a URL, publishable key, secret key, project ref e a URL pública do site.
4. Autentique o CLI localmente:

   ```bash
   npm run supabase:login
   ```

5. Vincule este diretório ao projeto, substituindo pelo Reference ID real:

   ```bash
   npx supabase link --project-ref PROJECT_REF
   ```

6. Revise as migrations e, somente após autorização, aplique-as:

   ```bash
   npm run db:push
   ```

7. Somente em um banco vazio, aplique o seed inicial do Felipe:

   ```bash
   npm run db:seed:empty
   ```

   Esse comando inclui `supabase/seed.sql` no push. O próprio SQL abre uma transação e aborta se qualquer tabela da aplicação já tiver dados. Nunca use `db reset` em banco remoto.

8. Gere os tipos do schema público:

   ```bash
   npm run db:types
   ```

9. Crie o primeiro usuário em Authentication → Users e atribua `{"role":"admin"}` ao `app_metadata` por uma operação administrativa segura. Não coloque o papel em `user_metadata`, pois o usuário pode alterar esse campo.
10. Inicie a aplicação:

   ```bash
   npm run dev
   ```

A migration cria as tabelas `ambassadors`, `benefits`, `testimonials`, `faqs` e `leads`, índices, validações, triggers, políticas RLS e o bucket público `ambassador-assets`. A secret key é lida somente em código de servidor.

## Comandos

Todos os scripts principais são portáveis entre Windows/PowerShell, Linux e macOS.

```bash
npm run dev       # Vite/Vinext local
npm run lint      # ESLint
npm run typecheck # TypeScript sem emissão
npm run build     # build Cloudflare/Vinext
npm run build:vercel # build nativo Next.js usado pela Vercel
npm run check     # lint + tipos + testes + build Vercel
npm test          # build + teste do HTML renderizado
npm run supabase:login
npm run supabase:link
npm run db:push
npm run db:pull
npm run db:diff
npm run db:migration:new -- nome_da_migration
npm run db:types
npm run db:seed:empty # somente para banco vazio e com autorização
```

## Funcionalidades

- Listagem, busca e filtro por publicado, rascunho e arquivado.
- Cadastro, edição, duplicação, publicação, despublicação, arquivamento e exclusão confirmada.
- Benefícios, depoimentos e FAQs em tabelas relacionadas com `sort_order`.
- Upload de imagens no Supabase Storage (limite de 5 MB).
- Pré-visualização administrativa assinada e válida por 15 minutos.
- Lead com validação dupla, máscara brasileira, consentimento LGPD, honeypot, tempo mínimo de preenchimento e UTMs.
- Eventos `generate_lead` para `dataLayer` (GA4) e `Lead` para Meta Pixel quando os scripts estiverem configurados.
- Metadados individuais, canonical, Open Graph, Twitter Cards, JSON-LD, sitemap e robots.
- 404 para slugs inexistentes, rascunhos e páginas arquivadas.

## Segurança e operação

- Configure `NEXT_PUBLIC_SITE_URL` com a origem canônica em produção.
- Restrinja e rotacione a secret key no Supabase; ela é usada apenas em Route Handlers.
- `db:push`, `db:pull`, `db:seed:empty` e comandos administrativos são manuais. Não há aplicação automática de migrations ao salvar arquivos.
- Configure GA4/Meta Pixel externamente antes de esperar eventos nos respectivos painéis.
- O rate limiting definitivo deve ser aplicado no Cloudflare WAF/Rate Limiting; a aplicação já inclui barreiras básicas contra bots, mas limites distribuídos pertencem à borda.
- Não há deploy ou push automatizado neste repositório.

## Preparação para GitHub e Vercel

Este diretório ainda não é um repositório Git e nenhum repositório, commit, push ou deploy é criado pelos scripts do projeto. O arquivo `vercel.json` apenas declara o framework, `npm ci` e o build nativo do Next.js.

Antes da primeira publicação:

1. Use Node.js 22.13 ou superior (e inferior a 25) e npm 11.
2. Execute `npm ci` e `npm run check` em uma cópia limpa.
3. Crie o repositório GitHub manualmente e confirme que `.env.local`, `.vercel`, builds, caches e arquivos temporários continuam ignorados.
4. Importe o repositório na Vercel com a raiz apontando para esta pasta e o preset **Next.js**. O `vercel.json` já usa `npm run build:vercel`.
5. Cadastre na Vercel, com escopo separado para Preview e Production:
   - `NEXT_PUBLIC_SUPABASE_URL`;
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`;
   - `SUPABASE_SECRET_KEY` (marcada como sensível e somente no servidor);
   - `NEXT_PUBLIC_SITE_URL` (a URL canônica de cada ambiente).
6. `SUPABASE_PROJECT_REF` é necessário apenas para operações locais do CLI e não precisa ficar disponível ao runtime da Vercel.
7. Não conecte previews ao banco de produção se eles permitirem operações administrativas; prefira um projeto Supabase separado ou mantenha o acesso administrativo desabilitado em Preview.
8. Depois do primeiro preview, valide `/`, `/embaixadores/felipe`, `/admin/login`, `robots.txt`, `sitemap.xml`, cabeçalhos de segurança e os fluxos autenticados antes de promover o mesmo artefato para produção.

### Publicação manual sugerida

```bash
# somente depois de criar o repositório e configurar as variáveis na Vercel
npm ci
npm run check
npx vercel link
npx vercel env pull .env.local
npx vercel build
npx vercel deploy --prebuilt
```

Promova para produção somente após validar o preview. Não execute migrations ou seed durante o build da Vercel; essas operações permanecem manuais e separadas do deploy.

## Controles e limitações operacionais

- Cabeçalhos globais bloqueiam framing, sniffing de MIME, permissões desnecessárias e fontes/objetos externos; a CSP permite apenas conexões à própria aplicação e ao projeto Supabase configurado.
- As URLs editáveis são aceitas apenas quando usam HTTP/HTTPS; CTAs também podem usar âncoras e caminhos internos. Isso evita protocolos executáveis em conteúdo administrável.
- O endpoint de leads valida origem, tamanho do corpo, formato, consentimento, honeypot e tempo mínimo de preenchimento. Rate limiting distribuído ainda deve ser configurado na borda da Vercel/Firewall antes do tráfego de produção.
- A proteção de dados é aplicada nas APIs e no Supabase. A guarda visual do `/admin` é client-side porque a sessão atual do Supabase está no armazenamento do navegador; uma futura migração para cookies HttpOnly com `@supabase/ssr` permitiria redirecionamento server-side também.
- Atualizações de embaixadores e coleções relacionadas ainda não são uma única transação SQL. Uma falha entre exclusão e reinserção de benefícios/depoimentos/FAQs pode exigir nova tentativa; antes de crescer o uso administrativo, prefira uma função RPC transacional versionada em nova migration.
- `NEXT_PUBLIC_GA4_ID` e `NEXT_PUBLIC_META_PIXEL_ID` são reservadas no template de ambiente, mas o projeto não injeta trackers automaticamente. Eventos só são enviados quando `dataLayer`/`fbq` já foram carregados com consentimento; ao habilitar esses fornecedores, revise também as allowlists da CSP em `next.config.ts`.
