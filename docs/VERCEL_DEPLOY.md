# Deploy na Vercel – sem admin-lte

## Por que ainda aparece admin-lte no build?

O **projeto local** já está limpo: `package.json` não tem `admin-lte`.  
A Vercel faz deploy do repositório que está **conectado no projeto**. Nos logs aparece:

```text
Cloning github.com/primesoftcbisa/primesoft-cbisa (Branch: main, Commit: ...)
```

Ou seja, a Vercel está buildando o repo **primesoftcbisa/primesoft-cbisa**, não o seu clone (ex.: **williandallalibera/primesoft-cbisa**).  
Se você só faz `git push origin main`, está atualizando **o seu** repo; o repo que a Vercel clona continua com o `package.json` antigo (com admin-lte).

## O que fazer

### Opção A: Fazer push para o mesmo repo que a Vercel usa

Se você tem permissão no **primesoftcbisa/primesoft-cbisa**:

1. Adicione esse repo como remote (só uma vez):
   ```bash
   git remote add vercel https://github.com/primesoftcbisa/primesoft-cbisa.git
   ```
2. Envie o código limpo (sem admin-lte) para a branch que a Vercel usa (geralmente `main`):
   ```bash
   git push vercel main
   ```
3. A Vercel vai fazer um novo deploy com o `package.json` e o código atuais (sem admin-lte).

### Opção B: Usar o seu repo no deploy da Vercel

Se preferir que a Vercel use **williandallalibera/primesoft-cbisa**:

1. No dashboard da Vercel: **Project → Settings → Git**.
2. Troque o **Connected Git Repository** para **williandallalibera/primesoft-cbisa** (e a branch, ex. `main`).
3. Depois disso, seu `git push origin main` passa a disparar o deploy; não precisa dar push em outro repo.

## Conferir

Depois do push correto, no próximo build dos logs da Vercel deve aparecer:

- O **commit** mais recente do repo que você atualizou.
- **Nenhum** `admin-lte@"^3.2.0" from the root project` (o install não deve mais listar admin-lte como dependência do projeto).

Se ainda aparecer admin-lte, o clone da Vercel continua vindo do repo antigo: use a Opção A ou B acima.
