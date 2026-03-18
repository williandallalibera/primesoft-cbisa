# Plano: Conectar Supabase, Banco, CRUDs e Primeira Versão no Vercel (até 13:00)

Cronograma objetivo para você seguir em ordem. A parte técnica pesada (SQL, código) já está preparada; você fará principalmente criação de contas, copiar/colar e deploy.

---

## O que você precisa ter à mão

- **Email** para criar conta no Supabase (se ainda não tiver).
- **Email** para criar conta no Vercel (ou GitHub já conectado ao Vercel).
- **Repositório do projeto no GitHub** (se for fazer deploy pelo Vercel conectando ao repo).

---

## Fase 1 — Supabase (≈ 25 min)

### 1.1 Criar projeto no Supabase (5 min)

1. Acesse [supabase.com](https://supabase.com) e faça login (ou crie conta).
2. Clique em **“New project”**.
3. Preencha:
   - **Name:** `primesoft-cbisa` (ou o nome que quiser).
   - **Database Password:** anote em lugar seguro (você usa só no SQL Editor se precisar).
   - **Region:** escolha a mais próxima (ex.: South America).
4. Clique em **“Create new project”** e espere terminar (1–2 min).

### 1.2 Pegar URL e chave do projeto (2 min)

1. No menu lateral: **Project Settings** (ícone de engrenagem).
2. Aba **“API”**.
3. Copie e guarde:
   - **Project URL** (ex.: `https://xxxxx.supabase.co`).
   - **anon public** (em “Project API keys”) — essa é a **Anon Key** (pública, vai no front).

Você vai colar esses dois valores no `.env` do projeto e depois no Vercel.

### 1.3 Criar tabelas e dados iniciais (10 min)

1. No menu lateral: **SQL Editor**.
2. Clique em **“New query”**.
3. Abra no seu projeto o arquivo **`supabase/apply_schema.sql`** (está na pasta `supabase`).
4. Copie **todo** o conteúdo desse arquivo e cole no SQL Editor.
5. Clique em **“Run”** (ou Ctrl+Enter).
6. Deve aparecer “Success” em verde. Se aparecer algum erro, copie a mensagem e me envie.

Isso cria todas as tabelas, dados iniciais (culturas, categorias, etc.), o trigger que cria o perfil do usuário ao se cadastrar e as permissões (RLS) para usuários logados.

### 1.4 Desativar “Confirm email” (obrigatório para o login funcionar)

Se isso não estiver desativado, o Supabase devolve **“Invalid login credentials”** ou **“Email not confirmed”**.

1. No menu lateral: **Authentication** → **Providers**.
2. Clique em **Email**.
3. Procure **“Confirm email”** e **desligue** o toggle (deixe em OFF).
4. Clique em **Save**.

Só depois disso crie o usuário no passo 1.5.  
**Se o usuário já existia antes de desligar:** veja o passo 1.4.1 abaixo para confirmar o e-mail dele manualmente.

#### 1.4.1 Se aparecer “Email not confirmed” ao logar

Isso acontece quando o usuário foi criado **antes** de desativar “Confirm email”. O Supabase não confirma usuários antigos sozinho. Confirme o e-mail manualmente:

1. No Supabase: **SQL Editor** → **New query**.
2. Cole o comando abaixo e **troque** `SEU-EMAIL@exemplo.com` pelo **e-mail exato** do usuário que você usa para logar (o que está em Authentication → Users).
3. Execute (Run):

```sql
update auth.users
set email_confirmed_at = now()
where email = 'SEU-EMAIL@exemplo.com';
```

4. Tente fazer login de novo no app. Deve funcionar.

### 1.5 Criar seu primeiro usuário (admin) (3 min)

1. No menu lateral: **Authentication** → **Users**.
2. Clique em **“Add user”** → **“Create new user”**.
3. Preencha:
   - **Email:** um email que você vai usar para logar (ex.: `admin@primesoft.com` ou o seu).
   - **Password:** uma senha **simples de digitar e anotar** (ex.: `Admin123!`). Anote num papel — você vai digitar **exatamente a mesma** na tela de login.
4. Clique em **“Create user”**.
5. Na lista de usuários, **clique no usuário** que acabou de ser criado e **copie o “User UID”** (UUID).
6. Vá no **SQL Editor** → **New query** e rode (substitua `SEU-USER-UID-AQUI` pelo UUID que você copiou):

```sql
update public.usuarios
set perfil_acceso = 'admin', nombre = 'Admin'
where id = 'SEU-USER-UID-AQUI';
```

7. Clique em **Run**.
8. No app, faça login com **o mesmo email e a mesma senha** que você colocou ao criar o usuário (cuidado com maiúsculas/minúsculas e espaços).

### 1.6 Políticas de Storage para logos (evitar erro “new row violates row level security”)

Para que o upload de logos (Ajustes → Empresa) funcione sem erro de RLS:

1. No Supabase: **SQL Editor** → **New query**.
2. Abra o arquivo **`supabase/migrations/20260305120000_storage_empresa_rls.sql`** do projeto.
3. Copie todo o conteúdo, cole no Editor e clique em **Run**.

Assim o bucket `empresa` fica criado/atualizado e usuários autenticados podem subir e leer archivos.

### 1.7 Bucket manual (só se não tiver rodado o script 1.6)

Se **não** tiver executado o SQL do passo 1.6, crie o bucket à mão: **Storage** → **New bucket** → nome `empresa`, **Public**, file size limit `52428800` (50 MB).

---

## Fase 2 — Projeto local: conectar ao Supabase (≈ 10 min)

### 2.1 Arquivo .env

1. Na raiz do projeto (pasta onde está o `package.json`), crie um arquivo chamado **`.env`** (com o ponto na frente).
2. Deixe o conteúdo assim (troque pelos seus valores do Supabase):

```
VITE_SUPABASE_URL=https://SEU-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

3. Salve. **Não** commite o `.env` no Git (ele já deve estar no `.gitignore`).

### 2.2 Testar no navegador

1. No terminal, na pasta do projeto, rode: `npm run dev`.
2. Abra o navegador em `http://localhost:5173`.
3. Faça login com o **email e senha** do usuário que você criou no passo 1.4.
4. Confira se entra no sistema e se consegue abrir:
   - Ajustes → Empresa (salvar algo).
   - Ajustes → Integraciones (salvar chaves se quiser).
   - CRM → Clientes ou Propuestas (listar/criar).

Se der erro de “perfil não encontrado”, volte ao 1.4 e confira se o UUID no `update` está correto e se rodou o `apply_schema.sql` antes (trigger que cria linha em `usuarios`).

---

## Fase 3 — Edge Function e Cron (CBOT) (≈ 10 min)

### 3.1 Instalar Supabase CLI (só se ainda não tiver)

No terminal:

```bash
npm install -g supabase
```

(Se preferir não instalar, você pode fazer o deploy da function pelo Dashboard depois; eu descrevo o caminho pelo CLI que é o mais direto.)

### 3.2 Login e link do projeto

```bash
supabase login
supabase link --project-ref SEU-PROJECT-REF
```

O **project-ref** é a parte do meio da URL do projeto (ex.: `abcdefghijklmnop` em `https://abcdefghijklmnop.supabase.co`).

### 3.3 Deploy da função create-user (para crear usuarios sin auto-login)

Para que en Ajustes → Usuarios puedas crear usuarios **sin que la app cierre tu sesión** e inicie con el nuevo usuario:

```bash
supabase functions deploy create-user
```

### 3.4 Deploy da função cbot-sync

```bash
supabase functions deploy cbot-sync
```

Quando pedir, use a **service_role** key (em Project Settings → API → “service_role”, **secret**).

### 3.5 Agendar o cron (08:00 America/Asuncion)

1. No Supabase: **Database** → **Extensions** → ative **pg_cron** e **pg_net** (se não estiverem).
2. **Vault** (ou Project Settings): guarde dois secretos:
   - Nome: `project_url` → valor: `https://SEU-PROJECT-REF.supabase.co`
   - Nome: `anon_key` → valor: sua **Anon Key**
3. No **SQL Editor**, abra o arquivo **`supabase/migrations/20260305080000_cron_cbot_sync.sql`** do projeto.
4. Descomente o bloco que tem `cron.schedule('cbot-sync-daily', ...)` (apague os `/*` e `*/` em volta).
5. Ajuste no SQL o nome dos secretos se você tiver usado outros (ex.: `project_url` e `anon_key`).
6. Execute o script.

Assim a função que puxa os preços do Yahoo (CBOT) roda todo dia às 08:00 horário de Assunción.

---

## Fase 4 — Deploy no Vercel (≈ 15 min)

### 4.1 Subir código no GitHub

1. Crie um repositório no GitHub (se ainda não tiver).
2. Na pasta do projeto, no terminal:

```bash
git add .
git commit -m "Preparar deploy: Supabase + Vercel"
git remote add origin https://github.com/SEU-USUARIO/SEU-REPO.git
git push -u origin main
```

(Substitua SEU-USUARIO e SEU-REPO.)

### 4.2 Conectar no Vercel

1. Acesse [vercel.com](https://vercel.com) e faça login (pode ser com GitHub).
2. **“Add New…”** → **“Project”**.
3. Importe o repositório do projeto (ex.: `primesoft-cbisa`).
4. Em **“Configure Project”**:
   - **Framework Preset:** Vite.
   - **Build Command:** `npm run build`.
   - **Output Directory:** `dist`.
5. Em **“Environment Variables”** adicione:
   - **Name:** `VITE_SUPABASE_URL` → **Value:** a mesma URL do Supabase.
   - **Name:** `VITE_SUPABASE_ANON_KEY` → **Value:** a mesma Anon Key.
6. Clique em **“Deploy”**.

### 4.3 Testar a primeira versão

1. Quando o deploy terminar, Vercel mostra a URL (ex.: `primesoft-cbisa.vercel.app`).
2. Acesse e faça login com o mesmo usuário admin.
3. Teste: Ajustes, CRM, Parcelas, etc. Tudo que você testou no `localhost` deve se comportar igual, agora usando o Supabase de produção.

---

## Checklist rápido

- [ ] Projeto Supabase criado
- [ ] URL e Anon Key copiadas
- [ ] `apply_schema.sql` executado no SQL Editor
- [ ] Primeiro usuário criado em Authentication e virado admin em `usuarios`
- [ ] Bucket `empresa` criado (opcional)
- [ ] `.env` criado no projeto com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
- [ ] `npm run dev` → login e testes locais ok
- [ ] Edge Function `cbot-sync` deployada
- [ ] Cron do CBOT agendado (opcional)
- [ ] Código no GitHub
- [ ] Projeto importado no Vercel com as mesmas variáveis de ambiente
- [ ] Deploy concluído e acesso pela URL do Vercel

---

## Se algo der errado

### "Credenciales inválidas" ao logar

O Supabase costuma devolver a mesma mensagem genérica para **senha errada** e para **e-mail não confirmado**. Faça o seguinte:

**1) Desativar confirmação de e-mail (recomendado para dev)**  
- No Supabase: **Authentication** → **Providers** → **Email**.  
- Desative **"Confirm email"** (toggle em OFF).  
- Salve. Crie de novo o usuário em **Authentication** → **Users** → **Add user** (ou use o que já existe) e tente logar outra vez.

**2) Conferir usuário e senha**  
- Em **Authentication** → **Users**, confira o **email** do usuário (exatamente como está, sem espaço).  
- Ao criar o usuário, a senha é a que você digitou no momento de criar. Se não lembrar, **Add user** de novo com outro e-mail (ou o mesmo, apagando o anterior) e anote a senha.

**3) Confirmar o e-mail manualmente (se quiser manter "Confirm email" ativo)**  
- Em **Authentication** → **Users**, abra o usuário.  
- Se existir opção tipo **"Confirm email"** ou **"Email confirmed"**, marque como confirmado.  
- Em alguns projetos isso é feito em **Authentication** → **Users** → usuário → os três pontinhos → "Confirm email" (ou via SQL: atualizar `auth.users` e setar `email_confirmed_at`).

Depois de alterar o provider ou o usuário, tente logar de novo. A tela de login agora mostra a mensagem real do Supabase quando for algo diferente de “credenciais inválidas”; se aparecer outra frase, copie e envie para ajustarmos.

---

- **Login não funciona (entra mas dá erro de perfil):** confira se o `apply_schema.sql` foi rodado e se o trigger criou a linha em `usuarios`. Confira também se você rodou o `update` com o UUID certo para virar admin.
- **Erro ao salvar (empresa, integraciones, etc.):** confira se o script aplicou as políticas RLS (o `apply_schema.sql` inclui isso).
- **Vercel build falha:** confira se as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` estão preenchidas no Vercel.
