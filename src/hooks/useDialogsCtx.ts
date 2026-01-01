import useAssembledDialogs from './useAssembledDialogs';

export default function useDialogsCtx(params: unknown) {
  return useAssembledDialogs(params);
}

export function buildDialogsCtx(params: Record<string, unknown>) {
  // Thin wrapper to move the large dialogs ctx object out of App.tsx
  // Return as unknown to avoid spreading `any` widely; callers should
  // cast to the concrete dialog ctx type they expect.
  return params as unknown;
}
