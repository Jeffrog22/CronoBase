# Deploy — Cloudflare Pages (CronoBase)

Guia de publicação do CronoBase como PWA estática no **Cloudflare Pages**.

## Por que Cloudflare Pages

- App 100% estática (HTML/CSS/JS puro), sem build step e sem backend.
- HTTPS automático (exigido para Service Worker e Wake Lock).
- Deploy automático a cada push na branch `master`.
- Arquivo `_headers` na raiz controla os headers HTTP.

## Passo a passo

### 1. Criar o projeto

1. No painel Cloudflare → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Selecione o repositório `Jeffrog22/CronoBase`.
3. Configure:

| Campo | Valor |
|---|---|
| Framework preset | **None** |
| Build command | *(vazio)* |
| Build output directory | `/` (raiz do repositório) |
| Root directory | *(vazio)* |

4. **Save and Deploy**.

### 2. Headers HTTP (arquivo `_headers`)

O repositório já contém o arquivo `_headers` na raiz. O Cloudflare Pages o aplica automaticamente:

```
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin

/sw.js
  Cache-Control: no-cache
```

Pontos importantes:

- **`/sw.js` com `Cache-Control: no-cache`** — essencial para que o navegador sempre verifique atualizações do service worker. Sem isso, usuários ficam presos na versão antiga.
- Os demais assets são servidos com o cache padrão do Pages; o próprio service worker controla a cache local do app (`networkFirst` — rede primeiro, cache só como fallback offline, desde v0.2.1).

> Se editar `_headers`, o próximo deploy já aplica. Não há passo manual adicional.

### 3. PWA

- `manifest.webmanifest` e `icons/` estão na raiz e são cacheados pelo SW no install.
- O `start_url` do manifest é `./` — funciona em qualquer subdomínio.
- Nada de configuração extra no Pages para instalação da PWA; o navegador detecta o manifest.

### 4. Atualizações (importante para sessões em andamento)

O fluxo de atualização do app é:

1. O service worker **nunca** ativa uma nova versão sozinho (sem `skipWaiting` automático).
2. Quando uma nova versão instala, o app exibe o banner **"Nova versão disponível"**.
3. Se houver sessão não salva, o app pede confirmação antes de recarregar.
4. Só então envia `SKIP_WAITING` e recarrega.

Não há nada a configurar no Pages para isso — é comportamento do `sw.js` + `main.js`.

### 5. Domínio customizado (opcional)

1. Pages → seu projeto → **Custom domains** → **Set up a custom domain**.
2. Aponte o DNS (ou use o domínio já gerenciado no Cloudflare).
3. Certificado TLS é emitido automaticamente.

## Variáveis de ambiente

Nenhuma. O app não consome variáveis em runtime (não há build step).

## Verificação pós-deploy

- [ ] `https://<domínio>/` carrega e o cronômetro inicia um treino.
- [ ] `https://<domínio>/manifest.webmanifest` responde `200`.
- [ ] `https://<domínio>/sw.js` responde `200` **sem** cache longa (header `no-cache`).
- [ ] Instalação como PWA disponível ("Adicionar à tela inicial").
- [ ] Modo offline funciona após a primeira carga (desligar rede → recarregar).
- [ ] `npm test` verde antes do push (o deploy é automático a cada push).

## Rollback

No painel do Pages: **Deployments** → selecione o deployment anterior → **Retry deployment**. Como não há build, o rollback é imediato.
