# Condo App

Assistente virtual de condomínio. Cada condomínio é um ambiente independente, com moradores aprovados pela administração, uma biblioteca de documentos (convenção, regimento, atas, comunicados) e um assistente de IA que responde com base nesses documentos, citando arquivo e página.

São três áreas, todas responsivas (celular primeiro, com barra lateral a partir de 1024 px):

| Área | Quem usa | Rotas |
|---|---|---|
| Morador | Morador com vínculo aprovado | `/chat`, `/historico`, `/fontes/:id`, `/ajuda`, `/perfil`, `/configuracoes` |
| Administração | Síndico de um condomínio | `/admin/...` (documentos, moradores, solicitações, agente, personalização, uso, financeiro) |
| Plataforma | Administração da plataforma | `/plataforma/...` (condomínios e as mesmas áreas de cada condomínio) |

Entrada e vínculo: `/boas-vindas`, `/login`, `/cadastro`, `/recuperar-senha`, `/vinculo` (buscar condomínio), `/vinculo/status`.

## Stack

- **Front:** React 18, Vite, TypeScript, Tailwind e shadcn/ui, React Router e TanStack Query. A extração de texto dos documentos (pdf.js e mammoth) roda no navegador.
- **API:** Express (`server/`), PostgreSQL (Neon), JWT e login com Google. A IA usa a API da Groq.
- **Deploy:** Vercel. A API roda como Serverless Function (`api/index.ts`, que importa `server/src/app.ts`).

## Rodar localmente

```sh
npm install
npm install --prefix server

cp .env.example .env                 # VITE_API_URL=http://localhost:4002
cp server/.env.example server/.env   # preencha DATABASE_URL, JWT_SECRET, GROQ_API_KEY…

npm run db:migrate --prefix server   # aplica as migrações pendentes
npm run dev:all                      # front em :8080 e API em :4002
```

No primeiro acesso, `/setup` cria o administrador da plataforma (só funciona com o banco vazio).

## Variáveis de ambiente

**Front** (`.env`)

| Variável | Para quê |
|---|---|
| `VITE_API_URL` | Endereço da API. Em produção no Vercel (mesmo domínio), deixe vazio. |

**API** (`server/.env` e variáveis do projeto no Vercel)

| Variável | Obrigatória | Para quê |
|---|---|---|
| `DATABASE_URL` | sim | Postgres (Neon). Exige SSL, exceto em `localhost`. |
| `JWT_SECRET` | sim | Assinatura das sessões. |
| `GROQ_API_KEY` | sim | Respostas do assistente e processamento de documentos. |
| `CORS_ORIGIN` | sim | Endereço(s) do front, separados por vírgula. O primeiro também monta os links dos e-mails. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | para login com Google | OAuth do Google. |
| `RESEND_API_KEY`, `MAIL_FROM` | para recuperação de senha | E-mail transacional (Resend). Sem a chave, o link só aparece no log fora de produção. |
| `PORT` | não | Porta local da API (padrão 4002). |
| `GROQ_API_URL` | não | Só para testes: aponta a IA para um servidor falso. |

## Banco de dados e migrações

As migrações ficam em `server/db/migrations/` e são aplicadas em ordem por `npm run db:migrate --prefix server`. As já aplicadas ficam registradas na tabela `schema_migrations`.

| Migração | O que faz |
|---|---|
| `0001_init` | Condomínios, usuários, financeiro e base de conhecimento. |
| `0002_membership_and_auth` | Vínculo com aprovação, dados do morador e recuperação de senha. |
| `0003_documents` | Biblioteca de documentos, texto por página e arquivos (`bytea`). |
| `0004_conversations` | Conversas, mensagens e preferências do usuário. |
| `0005_activity_and_members` | Histórico de eventos e data de aprovação do morador. |
| `0006_agent_settings` | Configuração do assistente. Os condomínios existentes ficam liberados. |
| `0007_branding` | Identidade visual (nome de exibição, cores, logotipo e capa). |
| `0008_condo_details` | Cadastro completo do condomínio e índices de uso. |

> **Antes de publicar uma versão nova, rode as migrações no banco de produção.** O código depende das colunas novas: publicar sem migrar quebra o login e o chat. As migrações preservam os dados atuais. Usuários que já tinham condomínio ficam aprovados, e os trechos já indexados viram documentos processados.

## Testes e qualidade

```sh
npm test        # testes unitários (Vitest)
npm run lint    # ESLint
npm run build   # build de produção
```

## Estrutura

```
src/
  pages/            telas (morador na raiz; admin/, platform/, onboarding/)
  components/app/   componentes do design (PageHeader, SectionCard, StatusPill, ListRow…)
  components/ui/    shadcn/ui
  components/layout AppShell (barra superior, lateral e inferior) e navegação
  lib/              cliente da API, formatação, cores, documentos
server/
  src/routes/       rotas da API
  src/lib/          assistente (IA), agente, chunking, identidade visual, histórico
  db/migrations/    migrações SQL
```

## Decisões importantes

- **Isolamento por condomínio:** toda rota de dados confere o condomínio no servidor. O síndico só enxerga o próprio condomínio, e quem não tem vínculo aprovado não acessa dados de nenhum.
- **Privacidade das conversas:** cada morador vê só o próprio histórico. A administração vê indicadores de uso e as perguntas que ficaram sem resposta, sem identificar quem perguntou.
- **Documentos:** o texto é extraído no navegador e processado em lotes pela API, para respeitar o limite de tempo das funções do Vercel. O original fica guardado até 4 MB; o limite de corpo do Vercel é 4,5 MB.
- **Imagens de identidade:** PNG, JPEG ou WebP com até 2 MB. O tipo é conferido pelo conteúdo do arquivo, e SVG não é aceito.
