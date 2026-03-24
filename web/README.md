# Depara Web (Next.js)

Frontend moderno para comparação de arquivos tabulares.

## Suporte de formatos

- `.csv` com `.csv`
- `.xlsx` com `.xlsx`
- `.csv` com `.xlsx` (e vice-versa)

## Recursos

- Drag-and-drop e seleção manual de arquivos.
- Comparação linha a linha.
- Exibição completa com destaque:
  - verde para linhas iguais
  - vermelho para linhas diferentes
- Navegação por setas para erros.
- Filtros por status.
- Exportação de resultado em CSV.
- Tema claro/escuro com persistência.

## Rodar local

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`.

## Build de produção

```bash
npm run build
npm start
```

## Deploy na Vercel

1. Suba este projeto no GitHub.
2. Importe o repositório na Vercel.
3. Defina `Root Directory` como `web`.
4. Preset: `Next.js`.
5. Deploy.
