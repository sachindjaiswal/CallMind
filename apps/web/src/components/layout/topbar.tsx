import { NavLink } from "react-router-dom";
import { Waves } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { navigation } from "./sidebar";

export function Topbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 md:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Waves className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold tracking-tight">CallMind</span>
        </div>

        <div className="hidden items-center gap-2 text-sm text-muted-foreground md:flex">
          <span className="font-medium text-foreground">Workspace</span>
          <span aria-hidden="true">/</span>
          <span>CallMind Intelligence</span>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="hidden sm:inline-flex">
            Hackathon build
          </Badge>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
            CM
          </div>
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-t border-border px-4 py-2 md:hidden">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )
            }
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.name}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
