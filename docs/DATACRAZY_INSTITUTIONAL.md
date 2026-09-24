# Integração institucional Data Crazy — 24/09/2026

Branch: feature/institutional-home-chatgpt-ads. Design aprovado sem alterações.
Nenhuma migration, alteração de dados históricos ou deploy de produção nesta etapa.

## Implementação

O canal institutional/chatgpt_ads estende o cliente e o processador existentes:
persistência no Supabase → HTTP 201 → processamento posterior → status synced/failed e retry.
A conversão central continua ligada somente à aceitação da API; nenhum Pixel/CAPI ChatGPT foi instalado.

- Contato: mesma busca por telefone/e-mail e atualização, preservando tags existentes.
- Negócio: Restaurante | ChatGPT Ads, externalId do registro Supabase. Repetições reutilizam esse negócio.
- Não reutiliza negócios recentes de embaixadores ou outros canais.
- Origem nativa: ChatGPT Ads.
- Formulário: LP Institucional - ChatGPT Ads.
- Intenção: tag correspondente e nota JSON; ausência de intenção usa só a tag geral e "Não informada".
- Catálogos de funil, etapa, responsável, tags e campos são verificados antes de qualquer criação/atualização.
- Felipe/Diego mantêm origem, tags, título, etapa, responsável e quatro campos anteriores.
- Erros do CRM não revertem nem apagam o lead. Erro sanitizado e próxima tentativa ficam no Supabase.
- Nota identificada por UUID da submissão; reprocessamento consulta notas antes de inserir novamente.

## Configuração identificada ao vivo

Valores lidos das variáveis Config na Vercel e conferidos no CRM, sem acessar/expor token:

| Destino | Nome | ID |
| --- | --- | --- |
| Funil | Simpliza | c1043354-d903-47f0-9e01-7a9a472992d8 |
| Etapa | Lead | 1a0c1bb6-eb98-49eb-b779-90b9f41bafb7 |
| Responsável CRM | Danielle Sanchez | dc465375-742a-4178-afcc-6bccaf3c82b4 |

Reutiliza DATACRAZY_PIPELINE_ID, DATACRAZY_STAGE_ID e DATACRAZY_ATTENDANT_ID.
A pré-validação institucional rejeita outros nomes/destinos; não há fallback para Plano Gratuito/Nutrição.
O código não altera automações do CRM.

## Campos existentes conferidos no catálogo de leads

IDs abaixo documentam a auditoria. O código resolve nomes únicos no catálogo real, não usa IDs inventados.

| Campo | ID | Valor |
| --- | --- | --- |
| Como Conheceu o Simpliza? | ba6eb474-d4fb-4ca4-8909-8dfa4a4981cc | ChatGPT Ads |
| Identificação do formulário | 8f6d88da-9ebe-482d-be94-685882394847 | LP Institucional - ChatGPT Ads |
| URL final | cfd8fb3b-fc8a-460a-9412-63edc592baf8 | source_url |
| Faturamento Mensal - formulário do site | cd314437-930b-4663-8204-16b1c6b934bc | monthly_revenue |
| Como podemos entrar em contato? | 81841c59-0253-4699-868b-37f1fe41e5e0 | WhatsApp / Ligação / E-mail |
| utm_source | 086c3016-5f17-45bd-b8c4-797a72e57e34 | primeira origem |
| utm_campaign | ee818b73-f276-4334-b244-912f3dd0848c | primeira campanha |
| utm_content | c10a7b58-98f5-403e-b408-2e2e39afd253 | primeiro conteúdo |

Origem do Lead (792d6bdd-e801-4609-a6c6-ce9549fd188b) é options: Site, Redes Sociais, Indicação, Direto, Outro.
Não aceita ChatGPT Ads atualmente. Não alteramos opções nem gravamos valor inválido.
Se futuramente aceitar exatamente ChatGPT Ads, o adaptador o preencherá também.
utm_medium, utm_term, intent e todos os parâmetros/IDs capturados, first-touch e conversion-touch
ficam na nota estruturada; campos homônimos adicionais só são preenchidos quando existentes e compatíveis.
Não criamos campos adicionais duplicados.

As rotas de campos seguem o cliente atual do CRM:
GET /api/crm/additionalFields?take=500&filter[entity]=lead
POST /api/crm/additional-fields/lead/{leadId}/{fieldId}, body {value}.
O contrato genérico foi conferido no JavaScript servido pelo CRM, sem executar gravação em lead.
Notas usam a API pública /api/v1/leads/{leadId}/notes, body {note}.
Referências: https://docs.datacrazy.io/api-reference/leads/atualizar-lead e
https://api.datacrazy.io/v1/api/openapi/v1/json.

## Ativação e pendência de teste real

DATACRAZY_INSTITUTIONAL_ENABLED é false por padrão e não foi ativada na Vercel.
É independente da flag global existente. Preview continua bloqueando TODO envio ao CRM,
mesmo se ambas as flags estiverem true. Leads institucionais ficam ignored enquanto o canal está retido.
Não há liberação retroativa automática do teste anterior.
Quando autorizado/configurado fora de Preview, novos leads chatgpt_ads ficam pending;
outras origens institucionais permanecem ignored. A flag global preserva a pausa do worker.

NÃO foi enviado lead real nesta etapa.
Foi constatado gatilho "Lead criado" no Organizador de UTMs - V4
(88c16886-18c6-46a9-a6b3-075ea210d0db), além de automações comerciais existentes.
Não foi comprovada exclusão integral do novo canal de mensagens/automação comercial.
Antes de qualquer envio, validar manualmente todos os gatilhos de criação/atualização de contato,
tag, campo e negócio, incluindo contatos preexistentes com tags antigas.
Não basta usar telefone fictício, apontar o negócio para o funil correto ou ativar manualTestMode.
Não é seguro desativar automações globais para este teste.

A Preview fica disponível para revisão técnica com CRM bloqueado. A validação externa ainda
depende de um ambiente/fluxo comprovadamente sem disparos e autorização para esse ambiente.
Depois disso, executar exatamente uma submissão identificada e conferir contato, negócio,
campos, tags, nota e status no banco. Nunca reenviar automaticamente o teste institucional anterior.
