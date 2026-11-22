import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

export default function NotFoundPage() {
  return (
    <EmptyState
      icon={Compass}
      title="Page not found"
      description="The page you are looking for does not exist or has moved."
    >
      <Button asChild>
        <Link to="/">Return to dashboard</Link>
      </Button>
    </EmptyState>
  );
}
