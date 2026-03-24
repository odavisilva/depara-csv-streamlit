# Depara de Arquivos Tabulares (CSV/XLSX)

Projeto para comparar arquivos tabulares e mostrar claramente o que mudou entre dois lados (A vs B), com interface web moderna em Next.js e versão Python com Streamlit.

## Funcionalidades

- Comparação por posição de linha (linha 1 com linha 1, etc.).
- Suporte a formatos:
  - `.csv` vs `.csv`
  - `.xlsx` vs `.xlsx`
  - `.csv` vs `.xlsx` (e vice-versa)
- Detecção automática de formato por sufixo do arquivo.
- Upload comum e drag-and-drop para os dois arquivos.
- Exibição de todos os dados comparados:
  - linhas iguais em verde
  - linhas diferentes em vermelho
- Navegação rápida para erros com setas/atalhos por linha divergente.
- Filtros por status (`igual`, `diferente`, `somente_arquivo_a`, `somente_arquivo_b`).
- Exportação do resultado filtrado em CSV.
- Tema claro/escuro:
  - primeira carga segue o tema do sistema
  - toggle manual
  - persistência no navegador

## Estrutura do repositório

- `web/`: aplicação Next.js (principal para uso em equipe e deploy na Vercel)
- `app/`: aplicação Python Streamlit
- `test-data/`: arquivos de teste para validação manual

## Como rodar a versão web (recomendado)

### Requisitos

- Node.js 20+ (recomendado 22+)
- npm

### Passos

```bash
cd web
npm install
npm run dev
```

Acesse: `http://localhost:3000`

### Build de produção

```bash
cd web
npm run build
npm start
```

## Como usar

1. Envie o **Arquivo A** e o **Arquivo B** (`.csv` ou `.xlsx`).
2. Clique em **Comparar**.
3. Analise os KPIs e o detalhamento completo (verde/vermelho).
4. Use a seção de setas para pular direto para as divergências.
5. Aplique filtros se quiser focar em tipos específicos.
6. Clique em **Exportar CSV filtrado** para baixar o relatório.

## Deploy na Vercel

1. Suba o projeto no GitHub.
2. Importe o repositório na Vercel.
3. Configure `Root Directory` como `web`.
4. Preset: `Next.js`.
5. Deploy.

## Versão Python (opcional)

```bash
pip install -r requirements.txt
streamlit run app/main.py
```
