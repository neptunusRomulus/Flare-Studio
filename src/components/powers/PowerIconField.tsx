import { ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import { usePowerIconAtlas, type PowerIconKind } from '@/context/PowerIconAtlasContext';
import DraftInput from './DraftInput';

export default function PowerIconField({
  kind,
  id,
  value,
  onChange,
}: {
  kind: PowerIconKind;
  id: string;
  value: string;
  onChange: (value: string | null) => void;
}) {
  const { previewFor, importFor, iconSize, warning, canImport } = usePowerIconAtlas();
  const preview = previewFor(kind, id, value);
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 min-w-0">
        <div
          className="h-8 w-8 shrink-0 rounded-sm border border-border bg-background bg-center bg-no-repeat"
          style={preview ? { backgroundImage: `url("${preview}")`, backgroundSize: '100% 100%' } : undefined}
          aria-hidden
        />
        <DraftInput className="h-7 text-xs" value={value} onChange={(event) => onChange(event.target.value || null)} />
        <Tooltip content={canImport
          ? `Import a PNG. Studio scales it to a ${iconSize}×${iconSize} square (icon_size in engine/resolutions.txt) and packs it into the project icon atlas on save.`
          : 'This project uses icons from a required mod or the Start with template set. Import is available in Start from scratch projects.'}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={`h-7 text-xs shrink-0 ${canImport ? '' : 'opacity-50'}`}
            aria-disabled={canImport ? undefined : true}
            onClick={() => void importFor(kind, id, value)}
          >
            <ImagePlus className="w-3 h-3 mr-1" />Import
          </Button>
        </Tooltip>
      </div>
      {warning ? <p className="text-[11px] leading-snug text-amber-500">{warning}</p> : null}
    </div>
  );
}
