import { Outlet } from "react-router-dom";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border md:flex" />
      <div className="md:pl-64">
        <Topbar />
        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
