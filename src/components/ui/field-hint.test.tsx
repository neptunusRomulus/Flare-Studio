import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FieldHint, HintLabel } from './field-hint';
import { StudioHintsProvider } from '@/context/StudioHintsContext';

describe('FieldHint', () => {
  it('renders the child and keeps the hint for the tooltip when hints are on', () => {
    const html = renderToStaticMarkup(
      <StudioHintsProvider defaultEnabled>
        <FieldHint hint="Helper about this field">
          <span>Label</span>
        </FieldHint>
      </StudioHintsProvider>,
    );
    expect(html).toContain('Label');
    expect(html).toContain('data-studio-hint="Helper about this field"');
  });

  it('hides the hint when studio hints are off', () => {
    const html = renderToStaticMarkup(
      <StudioHintsProvider defaultEnabled={false}>
        <HintLabel hint="Do not show this">Name</HintLabel>
      </StudioHintsProvider>,
    );
    expect(html).toContain('Name');
    expect(html).not.toContain('Do not show this');
    expect(html).not.toContain('data-studio-hint');
  });
});
