import { askChoice, recentAnchorOrTop } from '@/components/ui/inlineConfirmCore';

export type CloseDecision = 'close' | 'save' | 'discard' | 'cancel';

/** What to tell main when the window is about to close. Asks only when there are unsaved changes. */
export async function decideClose(hasUnsaved: boolean, ask: typeof askChoice = askChoice): Promise<CloseDecision> {
  if (!hasUnsaved) return 'close';
  const answer = await ask({
    title: 'Unsaved changes',
    options: [
      { id: 'save', label: 'Save', primary: true },
      { id: 'discard', label: "Don't save" },
    ],
    cancelId: 'cancel',
    // Under the app's own close button when that was just pressed; otherwise top-center (Ctrl+Q, OS close).
    anchor: recentAnchorOrTop(),
  });
  return answer === 'save' || answer === 'discard' ? answer : 'cancel';
}
