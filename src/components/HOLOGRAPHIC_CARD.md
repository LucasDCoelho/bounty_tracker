# Componente HolographicCard

Um componente React que aplica um **efeito holográfico realista** em imagens de cartas, similar ao site [poke-holo.simey.me](https://poke-holo.simey.me/).

## Características

✨ **Efeito Holográfico** - Brilho e reflexos realistas que seguem o movimento do mouse
🔄 **Rotação 3D** - A carta rotaciona em 3D baseado na posição do mouse
💫 **Glare/Shimmer** - Efeito de brilho dinâmico que acompanha o cursor
📱 **Responsivo** - Funciona bem em mobile (sem efeitos 3D em telas menores)
⚡ **Performance** - Otimizado com `will-change` e transformações eficientes

## Uso

### Importar o componente

```tsx
import { HolographicCard } from '@/components/holographic-card';
```

### Usar em seu código

```tsx
<HolographicCard 
  src={card.image_url} 
  alt={card.name} 
  className="shadow-2xl border border-border rounded-2xl w-full" 
/>
```

### Props

| Prop | Tipo | Descrição |
|------|------|-----------|
| `src` | `string` | URL da imagem da carta |
| `alt` | `string` | Texto alternativo para acessibilidade |
| `className` | `string` *(opcional)* | Classes CSS adicionais (Tailwind) |

## Como Funciona

1. **Rastreamento de Mouse**: Monitora a posição do mouse sobre o componente
2. **Cálculo de Rotação**: Baseia-se na distância do mouse do centro da carta
3. **Aplicação de CSS Variables**: Define `--rotate-x`, `--rotate-y`, `--pointer-x`, `--pointer-y`
4. **Camadas de Efeito**:
   - **`.cardShine`**: Camada holográfica com gradientes e linhas
   - **`.cardGlare`**: Camada de brilho/reflexo que segue o cursor
   - **Pseudo-elementos**: Detalhes como scanlines e efeitos adicionais

## Estilos CSS

Os estilos estão em `holographic-card.module.css` e incluem:

- **Gradientes Radiais** que seguem `--pointer-x` e `--pointer-y`
- **Linhas Holográficas** em padrões diagonais e horizontais
- **Mix-blend-modes**: `color-dodge`, `soft-light`, `hard-light` para efeitos realistas
- **Filtros**: `brightness`, `contrast`, `saturate` para melhor qualidade visual
- **Sombras Dinâmicas**: que aumentam ao fazer hover

## Customização

### Cores do Efeito

Altere as cores dos efeitos holográficos no arquivo `holographic-card.module.css`:

```css
/* Gradiente principal (branco/ciano) */
rgba(255, 255, 255, 0.4) /* cor inicial */
rgba(0, 255, 200, 0.1) /* cor intermediária */

/* Gradiente rainbow */
rgba(255, 0, 128, 0.1) /* rosa */
rgba(0, 255, 200, 0.1) /* ciano */
rgba(0, 100, 255, 0.1) /* azul */
```

### Intensidade do Efeito

Ajuste a opacidade e os filtros:

```css
.cardShine {
  opacity: calc(var(--card-opacity) * 0.85); /* 0.5 para mais sutil, 1 para mais intenso */
  filter: brightness(0.85) contrast(2) saturate(1.3); /* ajuste conforme necessário */
}
```

### Ângulo de Rotação

Modifique no arquivo `holographic-card.tsx`:

```typescript
const rotateX = ((y - centerY) / centerY) * 15; // altere 15 para mais/menos rotação
const rotateY = ((x - centerX) / centerX) * -15;
```

## Compatibilidade

- ✅ Chrome/Edge
- ✅ Firefox
- ✅ Safari
- ✅ Mobile (com efeitos reduzidos)

## Performance

- Usa `will-change` para otimizar renderização
- `transform-style: preserve-3d` em apenas elementos necessários
- Event listeners removidos automaticamente ao desmontar
- Sem requeries de layout (layout thrashing)

## Inspiração

Este componente foi inspirado pelo excelente trabalho em [pokemon-cards-css](https://github.com/simeydotme/pokemon-cards-css) do Simon Goellner.

---

**Dica**: Para melhor efeito visual, use imagens de alta qualidade (pelo menos 400x560px para cartas).
