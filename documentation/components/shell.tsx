import { navigation } from '@/lib/navigation';
import { sidebarOps } from './header';
import { SidebarNav } from './sidebar';

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-[90rem] px-4 sm:px-6">
      <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 overflow-y-auto border-r border-line py-8 pr-4 scrollbar-thin lg:block">
        <SidebarNav sections={navigation} ops={sidebarOps()} />
      </aside>
      <main className="min-w-0 flex-1 lg:pl-10">{children}</main>
    </div>
  );
}
