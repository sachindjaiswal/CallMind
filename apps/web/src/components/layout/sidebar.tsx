import { NavLink } from "react-router-dom";
import { AudioLines, CalendarRange, LayoutDashboard, Waves } from "lucide-react";
import { cn } from "@/lib/utils";
import { HealthIndicator } from "@/components/health-indicator";

const navigation = [
  { name: "Dashboard", to: "/", icon: LayoutDashboard, end: true },
  { name: "Recordings", to: "/recordings", icon: AudioLines, end: false },
  { name: "Daily reports", to: "/daily-reports", icon: CalendarRange, end: false },
] as const;

export function Sidebar({ className }: { className?: string }) {
  return (
    <aside className={cn("flex flex-col bg-card", className)}>
      <div className="flex h-16 items-center gap-3 border-b border-border px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-soft">
          <Waves className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight">CallMind</p>
          <p className="text-xs text-muted-foreground">Intelligence</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        <p className="px-2 pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Workspace
        </p>
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.name}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-3 border-t border-border p-4">
        <HealthIndicator />
        <p className="text-[11px] text-muted-foreground">
          Foundation build · v0.1.0
        </p>
      </div>
    </aside>
  );
}

export { navigation };
