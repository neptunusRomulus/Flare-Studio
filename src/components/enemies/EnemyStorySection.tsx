import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import LootRowsEditor from '@/components/LootRowsEditor';
import { LabelWithTooltip, MoreToggle, EditorSection, enemyInputCls } from './enemyFormPrimitives';
import { EVENT_SCRIPT_LIST_ID } from '@/hooks/useEventScripts';

export type EnemyStorySectionProps = {
  defeatStatus: string; setDefeatStatus: (v: string) => void;
  questLoot: string; setQuestLoot: (v: string) => void;
  handleSelectQuestLootItem: (itemId: string) => void;
  firstDefeatLoot: string; setFirstDefeatLoot: (v: string) => void;
  handleSelectFirstDefeatLootItem: (itemId: string) => void;
  convertStatus: string; setConvertStatus: (v: string) => void;
  script: string; setScript: (v: string) => void;
  customPropsRaw: string; setCustomPropsRaw: (v: string) => void;
  lootItems: NonNullable<React.ComponentProps<typeof LootRowsEditor>['items']>;
  storyMore: boolean; setStoryMore: React.Dispatch<React.SetStateAction<boolean>>;
};

const EnemyStorySection = ({
  defeatStatus, setDefeatStatus,
  questLoot, setQuestLoot, handleSelectQuestLootItem,
  firstDefeatLoot, setFirstDefeatLoot, handleSelectFirstDefeatLootItem,
  convertStatus, setConvertStatus,
  script, setScript,
  customPropsRaw, setCustomPropsRaw,
  lootItems,
  storyMore, setStoryMore,
}: EnemyStorySectionProps) => (
    <EditorSection title="Story">
      <div className="space-y-2">
        <div className="space-y-1">
          <LabelWithTooltip field="defeatStatus">Story Flag on death</LabelWithTooltip>
          <Input value={defeatStatus} onChange={(e) => setDefeatStatus(e.target.value)} placeholder="e.g. boss_defeated" className={`${enemyInputCls} font-mono`} />
        </div>
        <div className="space-y-1">
          <LabelWithTooltip field="questLoot">Quest loot</LabelWithTooltip>
          <Input value={questLoot} onChange={(e) => setQuestLoot(e.target.value)} placeholder="required_status,required_not_status,item_id" className={`${enemyInputCls} font-mono`} />
          <Select value={questLoot.split(',').map((p) => p.trim()).slice(2).join(',')} onValueChange={handleSelectQuestLootItem}>
            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select item" /></SelectTrigger>
            <SelectContent>
              {lootItems.map((item) => (
                <SelectItem key={item.id} value={String(item.id)}>{item.name} ({item.id})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <MoreToggle open={storyMore} onToggle={() => setStoryMore((v) => !v)}>
        <div className="space-y-2">
          <div className="space-y-1">
            <LabelWithTooltip field="firstDefeatLoot">First defeat loot</LabelWithTooltip>
            <Input value={firstDefeatLoot} onChange={(e) => setFirstDefeatLoot(e.target.value)} className={`${enemyInputCls} font-mono`} />
            <Select value={firstDefeatLoot} onValueChange={handleSelectFirstDefeatLootItem}>
              <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select item" /></SelectTrigger>
              <SelectContent>
                {lootItems.map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>{item.name} ({item.id})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <LabelWithTooltip field="convertStatus">Convert status</LabelWithTooltip>
            <Input value={convertStatus} onChange={(e) => setConvertStatus(e.target.value)} className={`${enemyInputCls} font-mono`} />
          </div>
          <div className="space-y-1">
            <LabelWithTooltip field="script">Script</LabelWithTooltip>
            <Input value={script} onChange={(e) => setScript(e.target.value)} className={`${enemyInputCls} font-mono`} list={EVENT_SCRIPT_LIST_ID} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground font-normal">Raw properties</Label>
            <Textarea
              value={customPropsRaw}
              onChange={(e) => setCustomPropsRaw(e.target.value)}
              className="min-h-[8rem] w-full bg-muted/10 border border-border rounded-md p-2 font-mono text-xs focus-visible:ring-1 focus-visible:ring-orange-500 focus-visible:ring-offset-0 outline-none resize-y"
              placeholder="KEY=VALUE"
            />
            <p className="text-[10px] text-muted-foreground">Keys not covered above. Written as they are.</p>
          </div>
        </div>
      </MoreToggle>
    </EditorSection>
);

export default EnemyStorySection;
