import { Input } from '@/components/ui/input';
import { enemyPropertyTooltips } from './enemyModel';
import EnemyAppearancePicker from '@/components/enemies/EnemyAppearancePicker';
import { Flag, LabelWithTooltip, MoreToggle, EditorSection, enemyInputCls } from './enemyFormPrimitives';

export type EnemyLookSectionProps = {
  /** Project root, for the project's own animations/enemies and images/portraits. */
  projectPath: string;
  animations: string; setAnimations: (v: string) => void;
  sfxAttack: string; setSfxAttack: (v: string) => void;
  sfxHit: string; setSfxHit: (v: string) => void;
  sfxDie: string; setSfxDie: (v: string) => void;
  sfxCritDie: string; setSfxCritDie: (v: string) => void;
  sfxBlock: string; setSfxBlock: (v: string) => void;
  sfxLevelup: string; setSfxLevelup: (v: string) => void;
  sfxLowhp: string; setSfxLowhp: (v: string) => void;
  gfx: string; setGfx: (v: string) => void;
  tilesetPath: string; setTilesetPath: (v: string) => void;
  portraitPath: string; setPortraitPath: (v: string) => void;
  renderLayers: string; setRenderLayers: (v: string) => void;
  animationSlots: string; setAnimationSlots: (v: string) => void;
  suppressHp: boolean; setSuppressHp: (v: boolean) => void;
  corpseHasCollision: boolean; setCorpseHasCollision: (v: boolean) => void;
  corpseHasTimeout: boolean; setCorpseHasTimeout: (v: boolean) => void;
  corpseRenderBelow: boolean; setCorpseRenderBelow: (v: boolean) => void;
  lookMore: boolean; setLookMore: React.Dispatch<React.SetStateAction<boolean>>;
};

const EnemyLookSection = ({
  projectPath,
  animations, setAnimations,
  sfxAttack, setSfxAttack,
  sfxHit, setSfxHit,
  sfxDie, setSfxDie,
  sfxCritDie, setSfxCritDie,
  sfxBlock, setSfxBlock,
  sfxLevelup, setSfxLevelup,
  sfxLowhp, setSfxLowhp,
  gfx, setGfx,
  tilesetPath, setTilesetPath,
  portraitPath, setPortraitPath,
  renderLayers, setRenderLayers,
  animationSlots, setAnimationSlots,
  suppressHp, setSuppressHp,
  corpseHasCollision, setCorpseHasCollision,
  corpseHasTimeout, setCorpseHasTimeout,
  corpseRenderBelow, setCorpseRenderBelow,
  lookMore, setLookMore,
}: EnemyLookSectionProps) => {
  const applyLook = (props: Record<string, string | null>) => {
    if ('animations' in props) setAnimations(props.animations || '');
    if ('tilesetPath' in props) setTilesetPath(props.tilesetPath || '');
    if ('gfx' in props) setGfx(props.gfx || '');
  };
  const applyPortrait = (props: Record<string, string | null>) => {
    if ('portraitPath' in props) setPortraitPath(props.portraitPath || '');
  };

  return (
    <EditorSection title="Look">
      <EnemyAppearancePicker
        projectPath={projectPath}
        animations={animations}
        tilesetPath={tilesetPath}
        portraitPath={portraitPath}
        onSelectLook={applyLook}
        onSelectPortrait={applyPortrait}
      />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <LabelWithTooltip field="animations">Animations</LabelWithTooltip>
          <Input value={animations} onChange={(e) => setAnimations(e.target.value)} placeholder="animations/enemies/goblin.txt" className={`${enemyInputCls} font-mono`} />
        </div>
        <div className="space-y-1">
          <LabelWithTooltip field="sfxAttack">Attack sound</LabelWithTooltip>
          <Input value={sfxAttack} onChange={(e) => setSfxAttack(e.target.value)} placeholder="soundfx/enemies/hit.ogg" className={`${enemyInputCls} font-mono`} />
        </div>
        <div className="space-y-1">
          <LabelWithTooltip field="sfxHit">Hit sound</LabelWithTooltip>
          <Input value={sfxHit} onChange={(e) => setSfxHit(e.target.value)} placeholder="soundfx/enemies/pain.ogg" className={`${enemyInputCls} font-mono`} />
        </div>
        <div className="space-y-1">
          <LabelWithTooltip field="sfxDie">Death sound</LabelWithTooltip>
          <Input value={sfxDie} onChange={(e) => setSfxDie(e.target.value)} placeholder="soundfx/enemies/die.ogg" className={`${enemyInputCls} font-mono`} />
        </div>
      </div>
      <MoreToggle open={lookMore} onToggle={() => setLookMore((v) => !v)}>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <LabelWithTooltip field="gfx">GFX (deprecated)</LabelWithTooltip>
            <Input value={gfx} onChange={(e) => setGfx(e.target.value)} placeholder="Replaced by Animations on save" className={enemyInputCls} />
          </div>
          <div className="space-y-1">
            <LabelWithTooltip field="tilesetPath">Tileset source</LabelWithTooltip>
            <Input value={tilesetPath} onChange={(e) => setTilesetPath(e.target.value)} className={`${enemyInputCls} font-mono`} />
          </div>
          <div className="space-y-1">
            <LabelWithTooltip field="portrait">Portrait path</LabelWithTooltip>
            <Input value={portraitPath} onChange={(e) => setPortraitPath(e.target.value)} className={`${enemyInputCls} font-mono`} />
          </div>
          <div className="space-y-1">
            <LabelWithTooltip field="renderLayers">Render layers</LabelWithTooltip>
            <Input value={renderLayers} onChange={(e) => setRenderLayers(e.target.value)} placeholder="e.g. floor,object" className={enemyInputCls} />
          </div>
          <div className="space-y-1">
            <LabelWithTooltip field="animationSlots">Animation slots</LabelWithTooltip>
            <Input value={animationSlots} onChange={(e) => setAnimationSlots(e.target.value)} placeholder="e.g. body,weapon" className={enemyInputCls} />
          </div>
          <div className="space-y-1">
            <LabelWithTooltip field="sfxCritDie">Crit death sound</LabelWithTooltip>
            <Input value={sfxCritDie} onChange={(e) => setSfxCritDie(e.target.value)} className={`${enemyInputCls} font-mono`} />
          </div>
          <div className="space-y-1">
            <LabelWithTooltip field="sfxBlock">Block sound</LabelWithTooltip>
            <Input value={sfxBlock} onChange={(e) => setSfxBlock(e.target.value)} className={`${enemyInputCls} font-mono`} />
          </div>
          <div className="space-y-1">
            <LabelWithTooltip field="sfxLevelup">Level-up sound</LabelWithTooltip>
            <Input value={sfxLevelup} onChange={(e) => setSfxLevelup(e.target.value)} className={`${enemyInputCls} font-mono`} />
          </div>
          <div className="space-y-1">
            <LabelWithTooltip field="sfxLowhp">Low HP sound</LabelWithTooltip>
            <Input value={sfxLowhp} onChange={(e) => setSfxLowhp(e.target.value)} className={`${enemyInputCls} font-mono`} />
          </div>
        </div>
        <div className="flex flex-wrap gap-4 pt-1">
          <Flag checked={suppressHp} onChange={setSuppressHp} label="Hide HP bar" tip={enemyPropertyTooltips.suppressHp} />
          <Flag checked={corpseHasCollision} onChange={setCorpseHasCollision} label="Corpse blocks movement" tip={enemyPropertyTooltips.corpseHasCollision} />
          <Flag checked={corpseHasTimeout} onChange={setCorpseHasTimeout} label="Corpse disappears" tip={enemyPropertyTooltips.corpseHasTimeout} />
          <Flag checked={corpseRenderBelow} onChange={setCorpseRenderBelow} label="Draw corpse below" tip={enemyPropertyTooltips.corpseRenderBelow} />
        </div>
      </MoreToggle>
    </EditorSection>
  );
};

export default EnemyLookSection;
