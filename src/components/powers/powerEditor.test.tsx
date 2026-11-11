import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildPowerProject, type ProjectFile } from '@/editor/powers/powerProject';
import { PowerEditorBody } from './PowerEditorWindow';
import type { PowerProjectFiles } from './usePowerProjectFiles';

const files: ProjectFile[] = [
  { path: 'powers/powers.txt', text: '[power]\nid=10\nname=Frost Bolt\ntype=missile\nspeed=16\nrequires_mp=5\nmodifier_damage=multiply,130,0\npost_effect=slow,50,5s\nwall_reflect=true\n' },
  { path: 'powers/effects.txt', text: '[effect]\nid=slow\nname=Slow\ntype=speed\n\n[effect]\nid=lonely\nname=Lonely\ntype=stun\n' },
  { path: 'npcs/guard.txt', text: 'name=Guard\n[dialog]\nrequires_status=met_guard\n' },
];

const data = (): PowerProjectFiles => ({
  files, project: buildPowerProject(files), kinds: {}, loading: false,
  reload: async () => {}, writeFile: () => {}, textOf: (p: string) => files.find((f) => f.path === p)?.text ?? '', setKind: () => {},
});
const render = (type: 'power' | 'effect' | 'flag' | 'new', id: string) =>
  renderToStaticMarkup(<PowerEditorBody target={{ type, id }} data={data()} onClose={() => {}} onOpen={() => {}} />);

describe('power editor', () => {
  it('shows the summary, question sections, sliders, chain, warnings and rare keys', () => {
    const html = render('power', '10');
    expect(html).toContain('Costs 5 mana');
    for (const t of ['What does it do?', 'How is it used?', 'How does it look and sound?', 'When it hits, apply…', 'Properties']) expect(html).toContain(t);
    expect(html).toContain('Balanced');
    expect(html).toContain('Has a mana cost but no player can use it');
    expect(html).toContain('Wall reflect');
    expect(html).toContain('>Slow<');
  });

  it('shows effects as Buff/Debuff with an unused warning', () => {
    const html = render('effect', 'lonely');
    expect(html).toContain('Debuff');
    expect(html).toContain('This Debuff is never used');
  });

  it('shows story flags and template cards', () => {
    expect(render('flag', 'met_guard')).toContain('Nothing ever sets this flag');
    const cards = render('new', 'skill');
    for (const t of ['Fireball', 'Heal', 'Dash', 'Summon', 'Poison Arrow', 'Blank Skill']) expect(cards).toContain(t);
    expect(render('new', 'trap')).toContain('Poison Cloud');
    expect(render('new', 'debuff')).toContain('Slow Debuff');
  });
});
