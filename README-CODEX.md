# Simpliza — notas rápidas para desenvolvimento

O projeto já usa Supabase para conteúdo, autenticação administrativa, leads e Storage. A documentação vigente e completa está em `README.md`.

```bash
npm ci
npm run dev
npm run check
```

- Landing reutilizável: `app/components/landing-template.tsx`
- Painel: `app/admin`
- APIs: `app/api`
- Integração Supabase: `lib/supabase.ts`, `lib/supabase-browser.ts` e `supabase/`
- Identidade e responsividade: `app/globals.css`
- Build Vercel: `npm run build:vercel`

Não execute migrations, seed, commit, push ou deploy sem autorização explícita.
