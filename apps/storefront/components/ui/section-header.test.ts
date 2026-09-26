import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SectionHeader } from './section-header';

const render = (props: Parameters<typeof SectionHeader>[0]) =>
  renderToStaticMarkup(createElement(SectionHeader, props));

// Static markup: the contract is which attributes reach the header's parts. The
// homepage opts in; every other caller must render exactly what it did before.
describe('SectionHeader', () => {
  it('renders no motion attribute by default', () => {
    const html = render({ id: 't', title: 'Title', lead: 'Lead', action: 'Link' });
    expect(html).not.toContain('data-motion');
    expect(html).toContain('class="type-page-title"');
  });

  it('marks the title to rise and the lead and action to fade when motion is calm', () => {
    const html = render({ title: 'Title', lead: 'Lead', action: 'Link', motion: 'calm' });
    expect(html).toMatch(/<h2 data-motion="rise"/);
    expect(html.match(/data-motion="fade"/g)).toHaveLength(2);
  });

  it('sets the display step when asked', () => {
    expect(render({ title: 'Title', size: 'display' })).toContain('type-display');
  });
});
