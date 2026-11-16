import { Input } from '@/components/ui/input';
import LootRowsEditor from '@/components/LootRowsEditor';
import type { LootRow } from '@/editor/lootChance';
import { LabelWithTooltip, MoreToggle, EditorSection, enemyInputCls } from './enemyFormPrimitives';

export type EnemyLootSectionProps = {
  xp: string; setXp: (v: string) => void;
  lootRows: LootRow[]; setLootRows: (rows: LootRow[]) => void;
  lootItems: NonNullable<React.ComponentProps<typeof LootRowsEditor>['items']>;
  tableRows: Record<string, LootRow[]>;
  lootCountMin: string; setLootCountMin: (v: string) => void;
  lootCountMax: string; setLootCountMax: (v: string) => void;
  itemFind: string; setItemFind: (v: string) => void;
  currencyFind: string; setCurrencyFind: (v: string) => void;
  gold: string; setGold: (v: string) => void;
  lootMore: boolean; setLootMore: React.Dispatch<React.SetStateAction<boolean>>;
};

const EnemyLootSection = ({
  xp, setXp,
  lootRows, setLootRows,
  lootItems, tableRows,
  lootCountMin, setLootCountMin,
  lootCountMax, setLootCountMax,
  itemFind, setItemFind,
  currencyFind, setCurrencyFind,
  gold, setGold,
  lootMore, setLootMore,
}: EnemyLootSectionProps) => (
    <EditorSection title="Loot">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <LabelWithTooltip field="xp">Kill XP</LabelWithTooltip>
          <Input type="number" value={xp} onChange={(e) => setXp(e.target.value)} className={enemyInputCls} />
        </div>
      </div>
      <LootRowsEditor
        rows={lootRows}
        onChange={setLootRows}
        items={lootItems}
        summary={{
          lootCountMin: lootCountMin ? Number(lootCountMin) : undefined,
          lootCountMax: lootCountMax ? Number(lootCountMax) : undefined,
          dropMax: 1,
          expandTable: (path) => tableRows[path],
          itemName: (id) => lootItems.find((item) => String(item.id) === id)?.name || id,
        }}
      />
      <MoreToggle open={lootMore} onToggle={() => setLootMore((v) => !v)}>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <LabelWithTooltip field="lootCount">Loot count min</LabelWithTooltip>
            <Input value={lootCountMin} onChange={(e) => setLootCountMin(e.target.value)} placeholder="Min" className={enemyInputCls} />
          </div>
          <div className="space-y-1">
            <LabelWithTooltip field="lootCount">Loot count max</LabelWithTooltip>
            <Input value={lootCountMax} onChange={(e) => setLootCountMax(e.target.value)} placeholder="Max" className={enemyInputCls} />
          </div>
          <div className="space-y-1">
            <LabelWithTooltip field="itemFind">Item find %</LabelWithTooltip>
            <Input value={itemFind} onChange={(e) => setItemFind(e.target.value)} className={enemyInputCls} />
          </div>
          <div className="space-y-1">
            <LabelWithTooltip field="currencyFind">Currency find %</LabelWithTooltip>
            <Input value={currencyFind} onChange={(e) => setCurrencyFind(e.target.value)} className={enemyInputCls} />
          </div>
          <div className="space-y-1 col-span-2">
            <LabelWithTooltip field="gold">Base gold</LabelWithTooltip>
            <Input type="number" value={gold} onChange={(e) => setGold(e.target.value)} className={enemyInputCls} />
          </div>
        </div>
      </MoreToggle>
    </EditorSection>
);

export default EnemyLootSection;
