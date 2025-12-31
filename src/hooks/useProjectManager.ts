import useProjectIO from './useProjectIO';
import useProjectLoader from './useProjectLoader';

export default function useProjectManager(params: any) {
  const projectIO = useProjectIO(params);
  const projectLoader = useProjectLoader(params);

  return { ...projectIO, ...projectLoader };
}
