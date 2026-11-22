import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import EnemySpawnConditionsSection from './EnemySpawnConditionsSection';

describe('EnemySpawnConditionsSection', () => {
  it('shows the common map placement conditions', () => {
    const html = renderToStaticMarkup(<EnemySpawnConditionsSection values={{}} onChange={() => {}} />);
    expect(html).toContain('Spawn conditions');
    expect(html).toContain('Only affects this placement on the map.');
    for (const label of ['Needs status', 'Needs status off', 'Minimum level', 'Maximum level']) {
      expect(html).toContain(`aria-label="${label}"`);
    }
  });
});
