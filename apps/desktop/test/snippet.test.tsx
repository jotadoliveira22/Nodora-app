import { describe, expect, it } from 'vitest';
import { renderSnippet } from '../src/components/SearchPalette';

describe('renderSnippet', () => {
  it('convierte marcadores « » en <mark> sin usar innerHTML', () => {
    const nodes = renderSnippet('hola «mundo» y «más»…');
    // [texto, mark, texto, mark, texto]
    expect(nodes).toHaveLength(5);
    const mark = nodes[1] as { type: string; props: { children: string } };
    expect(mark.type).toBe('mark');
    expect(mark.props.children).toBe('mundo');
  });

  it('tolera snippets sin marcadores o malformados', () => {
    expect(renderSnippet('sin marcas')).toEqual(['sin marcas']);
    expect(renderSnippet('abierto « sin cierre')).toHaveLength(1);
  });
});
