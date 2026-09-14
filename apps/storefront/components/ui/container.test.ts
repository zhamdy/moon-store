import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Container } from './container';

// Rendered to static markup rather than a DOM: no DOM library is installed, and the
// contract under test is simply which attributes reach the element.
describe('Container', () => {
  it('forwards aria-labelledby and id to the rendered section', () => {
    const html = renderToStaticMarkup(
      createElement(
        Container,
        { as: 'section', 'aria-labelledby': 'moment-title', id: 'moment' },
        'content'
      )
    );

    expect(html).toMatch(/^<section\b/);
    expect(html).toContain('aria-labelledby="moment-title"');
    expect(html).toContain('id="moment"');
  });

  it('forwards data attributes', () => {
    const html = renderToStaticMarkup(
      createElement(Container, { 'data-surface': 'ink' } as never, 'content')
    );

    expect(html).toContain('data-surface="ink"');
  });

  it('applies the container width and gutters unless bleed', () => {
    const contained = renderToStaticMarkup(createElement(Container, null, 'content'));
    const bleed = renderToStaticMarkup(createElement(Container, { bleed: true }, 'content'));

    expect(contained).toContain('max-inline-size:var(--container-max)');
    expect(contained).toContain('padding-inline:var(--page-gutter)');
    expect(bleed).not.toContain('style=');
  });

  it('merges a caller className after the base class', () => {
    const html = renderToStaticMarkup(
      createElement(Container, { className: 'section-y' }, 'content')
    );

    expect(html).toContain('class="mx-auto section-y"');
  });
});
