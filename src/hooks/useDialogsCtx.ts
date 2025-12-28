export default function buildDialogsCtx(params: Record<string, unknown>) {
  // Thin wrapper to move the large dialogs ctx object out of App.tsx
  // Keep typing permissive for now to avoid wide ripple changes.
  return params as any;
}
