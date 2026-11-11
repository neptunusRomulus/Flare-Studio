/** New powers/effects from templates, as a list of file writes (pure). */
import type { PowerKind, PowerProject } from './powerProject';
import { POWER_TEMPLATES, EFFECT_TEMPLATES } from './powerTemplates';
import { appendBlock } from './sectionFile';
import { nextPowerId, uniqueEffectId } from './powerChecks';
import { EFFECTS_FILE, fileForNewPower } from './powerFiles';

export type CreateResult = { writes: Array<{ path: string; text: string }>; target: { type: 'power' | 'effect'; id: string }; kind?: PowerKind };

export function createFromTemplate(
  project: Pick<PowerProject, 'powers' | 'effects'>,
  textOf: (path: string) => string,
  kind: PowerKind | 'buff' | 'debuff',
  templateId: string | null,
): CreateResult {
  if (kind === 'buff' || kind === 'debuff') {
    const t = EFFECT_TEMPLATES.find((e) => e.id === templateId);
    const id = uniqueEffectId(t ? t.flareId : kind === 'buff' ? 'new_buff' : 'new_debuff', project);
    const keys: Array<[string, string]> = t ? t.keys : [['name', kind === 'buff' ? 'New Buff' : 'New Debuff'], ['type', kind === 'buff' ? 'speed' : 'damage']];
    return { writes: [{ path: EFFECTS_FILE, text: appendBlock(textOf(EFFECTS_FILE), 'effect', [['id', id], ...keys]) }], target: { type: 'effect', id } };
  }
  const t = POWER_TEMPLATES.find((p) => p.id === templateId && p.kind === kind);
  const id = nextPowerId(project);
  const path = fileForNewPower(kind, project.powers.map((p) => p.path));
  const keys: Array<[string, string]> = t ? [...t.keys] : [['name', 'New power'], ['type', 'fixed']];
  const writes: CreateResult['writes'] = [];
  if (t?.effect) {
    const et = EFFECT_TEMPLATES.find((e) => e.id === t.effect!.template);
    const existing = et && project.effects.find((e) => e.id === et.flareId);
    let effectId = existing?.id;
    if (!existing && et) {
      effectId = uniqueEffectId(et.flareId, project);
      writes.push({ path: EFFECTS_FILE, text: appendBlock(textOf(EFFECTS_FILE), 'effect', [['id', effectId], ...et.keys]) });
    }
    if (effectId) keys.push(['post_effect', `${effectId},${t.effect.magnitude},${t.effect.duration}`]);
  }
  writes.push({ path, text: appendBlock(textOf(path), 'power', [['id', id], ...keys]) });
  return { writes, target: { type: 'power', id }, kind };
}
