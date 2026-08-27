# Configuração do DataCrazy — Landing Pages de Embaixadores

A integração nasce desativada. Enquanto `DATACRAZY_INTEGRATION_ENABLED=false`, todo lead continua salvo no Supabase com status **pendente**, e nenhuma chamada é feita ao DataCrazy.

## 1. Gerar a chave da API

1. Acesse [crm.datacrazy.io](https://crm.datacrazy.io/).
2. Abra **Configurações** e depois **Chaves de API**.
3. Clique em **Criar nova chave**.
4. Use o nome `Landing Pages Embaixadores`.
5. Copie a chave imediatamente. O DataCrazy informa que ela aparece somente uma vez.
6. Cadastre a chave diretamente na Vercel como `DATACRAZY_API_TOKEN`.

Nunca envie a chave por WhatsApp, e-mail, chamado ou mensagem. Não a coloque em `.env.example`, arquivos do projeto ou capturas de tela.

Documentação oficial: [gerar chave](https://docs.datacrazy.io/essencials/get-token).

## 2. Consultar funil, etapa e atendente com segurança

Recomendação inicial:

- Funil: `Simpliza`
- Etapa: `Novo lead — Embaixadores`

Se a etapa ainda não existir, crie-a no painel do DataCrazy antes de copiar o ID.

O exemplo abaixo pede o token sem exibi-lo nem salvá-lo em arquivo. Execute no PowerShell. Feche a janela do terminal ao terminar.

```powershell
$secureToken = Read-Host 'Cole o token do DataCrazy' -AsSecureString
$tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
try {
  $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer)
  $headers = @{ Authorization = "Bearer $token" }

  # Funis: localize "Simpliza" e copie seu id.
  (Invoke-RestMethod 'https://api.g1.datacrazy.io/api/v1/pipelines' -Headers $headers).data |
    Select-Object id, name, description

  # Troque SOMENTE o texto ID_DO_FUNIL pelo id copiado.
  (Invoke-RestMethod 'https://api.g1.datacrazy.io/api/v1/pipelines/ID_DO_FUNIL/stages' -Headers $headers).data |
    Select-Object id, name, index

  # Localize a pessoa responsável e copie o id (não o userId).
  (Invoke-RestMethod 'https://api.g1.datacrazy.io/api/v1/attendants/crm' -Headers $headers).data |
    Select-Object id, name, email
}
finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer)
  Remove-Variable token, secureToken, headers -ErrorAction SilentlyContinue
}
```

Os endpoints acima são os documentados oficialmente: [funis](https://docs.datacrazy.io/api-reference/pipelines/buscar-pipelines), [etapas](https://docs.datacrazy.io/api-reference/pipelines/buscar-etapas-da-pipeline) e [atendentes CRM](https://docs.datacrazy.io/api-reference/atendentes-crm/buscar-atendentes-crm).

O `DATACRAZY_PIPELINE_ID` identifica o funil para conferência. O negócio é criado na etapa informada em `DATACRAZY_STAGE_ID`. O atendente é opcional para a API, mas deve ser definido para o encaminhamento comercial desejado.

## 3. Campos adicionais de negócio

Crie no DataCrazy, com a entidade **negócio**, estes quatro campos:

- `Faturamento Mensal`
- `Preferência de contato - Embaixadores`
- `Embaixador de origem`
- `URL da LP de origem`

A integração consulta o catálogo por nome a cada processamento, desconsiderando diferenças de caixa, acentos e espaços repetidos. IDs não ficam no código nem em variáveis. Campo ausente ou nome duplicado interrompe a tentativa antes da criação do negócio e deixa o lead elegível para retentativa.

O OpenAPI público ainda não descreve as rotas de valores de campos de negócio. O CRM atual as disponibiliza sob `/api/crm`; por isso `DATACRAZY_CRM_API_URL` fica isolada da base pública `/api/v1` e pode ser ajustada sem alterar o restante da integração.

## 4. Tags

Crie previamente `LP Embaixadores` e uma tag `Embaixador - {Nome público}` para cada embaixador. A integração busca por nome normalizado, preserva tags já vinculadas e não cria tags automaticamente. Tag ausente ou duplicada gera erro recuperável.

## 5. Configurar a Vercel

1. Abra o projeto na Vercel.
2. Entre em **Settings → Environment Variables**.
3. Cadastre as variáveis abaixo no ambiente **Production**.
4. Não use aspas nos valores, salvo necessidade técnica.
5. Mantenha `DATACRAZY_INTEGRATION_ENABLED=false` no primeiro deploy.
6. Salve e faça um novo deploy de produção.

Variáveis mínimas para o contato e o negócio:

```env
DATACRAZY_INTEGRATION_ENABLED=false
DATACRAZY_API_URL=https://api.g1.datacrazy.io/api/v1
DATACRAZY_CRM_API_URL=https://crm.g1.datacrazy.io
DATACRAZY_API_TOKEN=valor_obtido_no_painel
DATACRAZY_PIPELINE_ID=id_do_funil
DATACRAZY_STAGE_ID=id_da_etapa
DATACRAZY_ATTENDANT_ID=id_do_atendente
DATACRAZY_TIMEOUT_MS=8000
CRON_SECRET=segredo_longo_e_aleatorio
```

O cron está configurado para rodar a cada 5 minutos. Essa frequência exige um plano Vercel que aceite cron com intervalo menor que um dia. Em plano Hobby, altere a frequência ou use outro agendador seguro; o endpoint `/api/cron/datacrazy` já está protegido por `CRON_SECRET`.

## 6. Teste manual controlado

Antes da ativação geral, use um e-mail e telefone fictícios que tenham sido previamente autorizados pela equipe. Cadastre-os na Vercel:

```env
DATACRAZY_INTEGRATION_ENABLED=true
DATACRAZY_MANUAL_TEST_MODE=true
DATACRAZY_MANUAL_TEST_EMAIL=email_ficticio_autorizado
DATACRAZY_MANUAL_TEST_PHONE=+5511999999999
```

Nesse modo, o cron geral não processa a fila e somente a submissão que corresponda exatamente aos dois valores autorizados pode ser sincronizada imediatamente. Depois do teste:

1. confira o lead, a tag, o negócio, a etapa e o atendente no DataCrazy;
2. volte `DATACRAZY_MANUAL_TEST_MODE=false`;
3. faça novo deploy;
4. só então mantenha `DATACRAZY_INTEGRATION_ENABLED=true` para produção.

Não use dados de uma pessoa real sem consentimento para testar.

## 7. Como funciona a duplicidade e a retentativa

- Uma repetição técnica do formulário reutiliza o mesmo registro do Supabase.
- O UUID local vira `crm_external_id` e `externalId` do negócio.
- Antes de criar o negócio, a integração consulta os negócios do contato pelo endpoint oficial e procura esse `externalId`.
- Por padrão, um negócio aberto do mesmo contato e embaixador, criado nos últimos 30 dias, pode ser reutilizado.
- Uma nova oportunidade legítima depois desse período pode criar outro negócio.
- Falhas são tentadas novamente após 1 minuto, 5 minutos, 30 minutos e 2 horas; falhas posteriores aguardam 24 horas.
- Em HTTP 429, o sistema respeita `Retry-After`. O limite oficial é [60 requisições por minuto por rota](https://docs.datacrazy.io/essencials/rate-limit).

No painel administrativo, abra `/admin/leads` para consultar o estado e solicitar uma nova tentativa sem expor o token.

## 8. Checklist antes de ativar

- [ ] Chave da API
- [ ] ID do funil
- [ ] ID da etapa
- [ ] ID do atendente
- [ ] Tags geral e específicas criadas com nomes únicos
- [ ] Quatro campos adicionais de negócio criados com nomes únicos
- [ ] Regra de duplicidade de 30 dias confirmada
- [ ] Responsável comercial confirmado
- [ ] Migration `202608250001_add_datacrazy_lead_sync.sql` aplicada
- [ ] `CRON_SECRET` longo e aleatório configurado
- [ ] Teste manual controlado concluído
- [ ] Novo deploy feito após trocar a flag de ativação

## 9. Desativação rápida

Em caso de dúvida, defina `DATACRAZY_INTEGRATION_ENABLED=false` e faça novo deploy. Os formulários continuam salvando no Supabase; os itens ficam pendentes para reprocessamento futuro.
