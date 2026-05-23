# Molycop Market Intelligence — Deploy em thesphera.com

Dashboard executivo de inteligência de mercado, pronto para rodar em **Vercel** com seu domínio `thesphera.com`.

## O que está incluído

```
thesphera-dashboard/
├── index.html           # Dashboard principal (single-page)
├── api/
│   ├── data.js          # Serverless: commodities (Stooq) + FX (Frankfurter)
│   └── news.js          # Serverless: notícias via RSS (mining.com, mining weekly, steelorbis)
├── data/
│   └── analysis.json    # Conteúdo curado da seção "Análise" — atualizo via Cowork
├── package.json
├── vercel.json
└── README.md            # Você está aqui
```

## Como funciona o refresh

| Mecanismo                   | O que faz                                                                                                |
| --------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Auto-refresh on load**    | Toda vez que você abre o site, ele puxa preços + FX + notícias frescas das serverless functions.         |
| **Botão "Atualizar"**       | Re-puxa tudo imediatamente.                                                                              |
| **Auto-refresh 1×/hora**    | Se a aba ficar aberta, atualiza sozinha a cada 60 min.                                                   |
| **Cache CDN (15 min)**      | Vercel cacheia respostas das APIs por 15 min para reduzir chamadas externas e dar resposta instantânea. |
| **Análise (`analysis.json`)** | Curada manualmente. Atualizo pelo Cowork → você dá push no GitHub → Vercel publica.                    |

## Deploy passo-a-passo

### 1. Adicionar ao seu repositório do GitHub

Você já tem o thesphera.com no Vercel via GitHub. Há duas opções:

#### Opção A — Pasta dedicada `/market-intel` dentro do repo existente
Boa para manter o dashboard como subdiretório do site, acessível em `thesphera.com/market-intel` ou via subdomain.

```bash
# Na raiz do seu repo local
mkdir market-intel
cp -r /caminho/thesphera-dashboard/* market-intel/
git add market-intel
git commit -m "feat: add market intel dashboard"
git push
```

Depois, no Vercel, configure o domínio para servir essa pasta — ou crie um **subdomínio** dedicado (recomendado): `intel.thesphera.com` apontando para um novo Vercel Project que tem só esse conteúdo.

#### Opção B — Novo repositório dedicado (recomendado se ainda está mexendo no site principal)
Mais limpo. Não interfere com o trabalho do SPHERA.

```bash
# Criar repo novo (via GitHub web ou gh CLI)
gh repo create thesphera-market-intel --private --source=. --remote=origin
cd /caminho/thesphera-dashboard
git init
git add .
git commit -m "init: market intel dashboard"
git push -u origin main
```

No Vercel:
1. **Add New Project** → importar o novo repo
2. Framework Preset: **Other** (é estático com serverless functions)
3. Root Directory: deixe vazio (raiz)
4. Deploy

### 2. Apontar o domínio

No Vercel Project → **Settings** → **Domains**:
- Adicione `intel.thesphera.com` (ou o subdomínio que preferir)
- Vercel te dá um CNAME para criar no seu DNS

Como seu domínio já está conectado ao Vercel, o DNS é gerenciado lá: só apertar **Add** e o subdomínio fica ativo em ~30 segundos.

### 3. Testar

Abra `https://intel.thesphera.com`. Você deve ver:
- O ponto verde ao lado do "Atualizado · DD/MM/AAAA HH:MM"
- Preços de Copper, Gold, Silver, Iron Ore, Brent, WTI nos KPIs
- FX strip com USD/CLP, USD/AUD, AUD/USD, etc.
- Manchetes do mining.com / mining weekly / steelorbis no feed
- Seção Análise renderizada do `analysis.json`

Se aparecer "Falha ao atualizar" em vermelho, as serverless functions estão com problema — abra o DevTools (F12) → Network e veja qual chamada falhou.

## Como atualizar o conteúdo curado

### Preços, FX, notícias — automático
Não precisa fazer nada. As serverless functions puxam tudo em tempo real.

### Seção "Análise" — eu atualizo pelo Cowork
Quando você quiser uma nova leitura executiva, me pede aqui no Cowork:

> "Atualize a análise do dashboard de mercado"

Eu reescrevo o `analysis.json` com a leitura do dia. Você só precisa:

```bash
git pull
# Eu te entrego o novo analysis.json — você copia para data/
git add data/analysis.json
git commit -m "update: market analysis YYYY-MM-DD"
git push
```

Vercel deploya automaticamente. Cache do CDN é de 5 min para arquivos em `/data/`, então o site refletiria a mudança em segundos.

### Concorrentes, macro, clientes — semi-estáticos
Esses estão hardcoded no `index.html` porque mudam mensalmente, não diariamente. Quando você receber novos reviews FY26 (mensal), me sobe os PDFs/PPTs e eu te entrego um novo `index.html`.

## Custo

Tudo gratuito no plano Free do Vercel:
- ✅ Hospedagem ilimitada para sites estáticos
- ✅ 100GB de bandwidth/mês
- ✅ 100k invocações de serverless function/mês (você usaria ~50–500/mês com refresh horário)
- ✅ Custom domain incluso

APIs públicas usadas:
- **Stooq** (commodities) — gratuito, sem chave
- **Frankfurter.app** (FX) — gratuito, sem chave, suporta múltiplas moedas
- **Mining.com / Mining Weekly / SteelOrbis** (notícias) — RSS público gratuito

Nenhuma API paga, nenhuma chave de API exposta.

## Trade-offs honestos

- **Preços nem sempre intraday.** Stooq dá fechamento do dia anterior + atual quando o mercado abre. Para tick-level real-time precisaria de provedor pago (Refinitiv, Bloomberg, Yahoo Finance Premium).
- **Iron ore: o ticker SGX TIO.F do Stooq pode ficar defasado.** Se notar inconsistência vs. Platts IODEX, dá pra trocar a fonte — me avisa.
- **Notícias filtradas por keywords.** O `news.js` filtra por palavras-chave (copper, BHP, Codelco, etc.). Pode ser que algumas notícias relevantes fiquem de fora — basta editar a lista `RELEVANT` no topo do arquivo.
- **Charts ainda com dados sample.** A linha do YTD usa dados de exemplo. Para curva real precisaria de fonte de histórico (ex.: alphavantage.co com chave gratuita).

## Próximos passos sugeridos

1. **Deploy mínimo** — sobe esse pacote como está, valida que o domínio + APIs funcionam.
2. **Refinar fontes** — depois de uma semana rodando, ajustamos quais commodity tickers e RSS feeds funcionam melhor para você.
3. **Adicionar histórico real** — integro alphavantage.co (gratuito com chave) para os gráficos de tendência.
4. **Webhook para refresh da Análise** — posso criar um GitHub Action que, quando você comentar `/refresh` num PR aberto, dispara workflow que me pinga e eu atualizo o `analysis.json` automaticamente.

---

Qualquer dúvida no deploy, me chama aqui no Cowork.
