import useAppToolbar from './useAppToolbar';
import useAppSidebarDeps from './useAppSidebarDeps';
import useAppMainBuilder from './useAppMainBuilder';

export default function useAppController() {
  const { toolbarValue } = useAppToolbar();
  const { sidebarDeps } = useAppSidebarDeps();
  const { buildAppMainCtxFromSidebar } = useAppMainBuilder();

  return { toolbarValue, sidebarDeps, buildAppMainCtxFromSidebar };
}
