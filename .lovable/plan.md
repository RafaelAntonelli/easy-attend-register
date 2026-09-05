# Novo ícone e tela de abertura com a logo da Arena Aquática

## O que será feito

1. **Ícone do app** — gerar a partir da imagem enviada (logo azul do nadador):
   - `public/favicon.png` (aba do navegador)
   - `public/icons/icon-192x192.png` e `public/icons/icon-512x512.png` (ícone do app instalado no Android/Windows)
   - `public/icons/apple-touch-icon.png` (iOS)
   - Todos redimensionados a partir da imagem enviada, mantendo o fundo preto.

2. **Tela de abertura** — hoje o app abre com um vídeo (`TransicaoVideo`). Será trocado para exibir a nova logo em tela cheia:
   - A imagem enviada passa a ser o CDN asset `src/assets/logo-arena.png.asset.json`.
   - Fundo da tela de abertura muda de azul (`#0d2270`) para **preto**, combinando com o fundo da imagem.
   - O comportamento se mantém: aparece ao abrir o app (~2,2s) e nas transições entre telas.

3. **Cores do app instalado (PWA)** — no `public/manifest.webmanifest`, `background_color` e `theme_color` mudam de azul para preto (`#000000`), para a tela de splash do Android e a barra do app ficarem pretas como a imagem.

## Detalhes técnicos

- A imagem enviada é usada de duas formas: cópia real em `public/` para os ícones (exigência do favicon/manifest) e ponteiro CDN (lovable-assets) para a tela de abertura.
- `TransicaoVideo.tsx` passa a renderizar `<img>` no lugar de `<video>`; o asset de vídeo antigo (`abertura-video.asset.json`) será removido por não ter mais uso.
- Arquivos tocados: `public/favicon.png`, `public/icons/*`, `public/manifest.webmanifest`, `src/components/TransicaoVideo.tsx`, novo `src/assets/logo-arena.png.asset.json`.
