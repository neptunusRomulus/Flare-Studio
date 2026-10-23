import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppContext } from '@/context/AppContext';
import { toast } from '@/hooks/use-toast';
import {
  canonicalJson,
  contentSlug,
  mergeEffectText,
  mergePowerText,
} from '@/adapters/flare/flareAdapter.cjs';
import { loadConfigDocument, writeProjectFiles } from '@/editor/projectFiles';

const POWER_TYPES = ['fixed', 'missile', 'repeater', 'spawn', 'transform', 'block'];
const EFFECT_TYPES = ['damage', 'damage_percent', 'heal', 'hpot', 'stun', 'speed', 'shield', 'revive'];

const PowerEffectForm = () => {
  const ctx = useAppContext();
  const currentProjectPath = typeof ctx.currentProjectPath === 'string' ? ctx.currentProjectPath : null;
  const [powerName, setPowerName] = useState('');
  const [powerId, setPowerId] = useState('');
  const [powerType, setPowerType] = useState('fixed');
  const [powerSpeed, setPowerSpeed] = useState('');
  const [effectName, setEffectName] = useState('');
  const [effectId, setEffectId] = useState('');
  const [effectType, setEffectType] = useState('damage');

  const savePower = async () => {
    if (!currentProjectPath) {
      toast({ title: 'No project', description: 'Open a project before writing a power.', variant: 'destructive' });
      return;
    }
    const id = powerId.trim() || contentSlug(powerName, 'power');
    const name = powerName.trim() || id;
    if (!name) return;
    const existing = await loadConfigDocument(currentProjectPath, 'powers/powers.txt');
    const power = { id, name, type: powerType, speed: powerSpeed.trim() };
    const text = mergePowerText(existing, [power]);
    const saved = await writeProjectFiles(currentProjectPath, [
      { path: 'powers/powers.txt', content: text },
      { path: `content/powers/${contentSlug(name, id)}.json`, content: canonicalJson('power', power) },
    ]);
    toast(saved
      ? { title: 'Power saved', description: `Added ${id} to powers/powers.txt.` }
      : { title: 'Save failed', description: 'Could not write powers/powers.txt.', variant: 'destructive' });
  };

  const saveEffect = async () => {
    if (!currentProjectPath) {
      toast({ title: 'No project', description: 'Open a project before writing an effect.', variant: 'destructive' });
      return;
    }
    const id = effectId.trim() || contentSlug(effectName, 'effect');
    const name = effectName.trim() || id;
    const existing = await loadConfigDocument(currentProjectPath, 'powers/effects.txt');
    const effect = { id, name, type: effectType };
    const text = mergeEffectText(existing, [effect]);
    const saved = await writeProjectFiles(currentProjectPath, [
      { path: 'powers/effects.txt', content: text },
      { path: `content/effects/${contentSlug(name, id)}.json`, content: canonicalJson('effect', effect) },
    ]);
    toast(saved
      ? { title: 'Effect saved', description: `Added ${id} to powers/effects.txt.` }
      : { title: 'Save failed', description: 'Could not write powers/effects.txt.', variant: 'destructive' });
  };

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Power</div>
      <Input value={powerName} onChange={(event) => setPowerName(event.target.value)} placeholder="Name" className="h-8" />
      <Input value={powerId} onChange={(event) => setPowerId(event.target.value)} placeholder="id" className="h-8" />
      <select className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm" value={powerType} onChange={(event) => setPowerType(event.target.value)}>
        {POWER_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
      </select>
      <Input value={powerSpeed} onChange={(event) => setPowerSpeed(event.target.value)} placeholder="speed" className="h-8" />
      <Button type="button" size="sm" onClick={() => { void savePower(); }} disabled={!powerName.trim() && !powerId.trim()}>
        Write power
      </Button>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Effect</div>
      <Input value={effectName} onChange={(event) => setEffectName(event.target.value)} placeholder="Name" className="h-8" />
      <Input value={effectId} onChange={(event) => setEffectId(event.target.value)} placeholder="id" className="h-8" />
      <select className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm" value={effectType} onChange={(event) => setEffectType(event.target.value)}>
        {EFFECT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
      </select>
      <Button type="button" size="sm" variant="outline" onClick={() => { void saveEffect(); }} disabled={!effectName.trim() && !effectId.trim()}>
        Write effect
      </Button>
    </div>
  );
};

export default PowerEffectForm;
