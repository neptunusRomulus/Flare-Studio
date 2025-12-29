import buildDialogsCtx from './useDialogsCtx';

/*
  Lightweight wrapper hook to assemble the dialogs context in one place
  to keep App.tsx slimmer. Accepts a big params object and delegates
  to existing `buildDialogsCtx` which merges/validates the shape.
*/
export default function useAssembledDialogs(params: unknown) {
  return buildDialogsCtx(params as Record<string, unknown>);
}
