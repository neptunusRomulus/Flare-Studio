import useProjectIO from './useProjectIO';
import useProjectLoader from './useProjectLoader';

export default function useProjectManager(
  params: Parameters<typeof useProjectIO>[0] & Parameters<typeof useProjectLoader>[0]
) {
  const projectIO = useProjectIO(params);
  const projectLoader = useProjectLoader(params);

  return { ...projectIO, ...projectLoader };
}
