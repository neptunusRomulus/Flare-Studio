import useAppToolbar from './useAppToolbar';
import useAppMainBuilder from './useAppMainBuilder';

export default function useAppController() {
  const { toolbarValue } = useAppToolbar();
  const { sidebarDeps, buildAppMainCtxFromSidebar } = useAppMainBuilder();

  return { toolbarValue, sidebarDeps, buildAppMainCtxFromSidebar };
}
