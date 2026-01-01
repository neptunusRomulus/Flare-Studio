import useProjectIO from './useProjectIO';
import useProjectLoader from './useProjectLoader';

export default function useProjectManager(params: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const projectIO = useProjectIO(params as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const projectLoader = useProjectLoader(params as any);

  return { ...projectIO, ...projectLoader };
}
