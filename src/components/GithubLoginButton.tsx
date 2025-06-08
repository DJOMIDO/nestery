// components/GithubLoginButton.tsx

"use client";

import { Button } from "@/components/ui/button";
import { Github } from "lucide-react";
import { cn } from "@/lib/utils";

interface GithubLoginButtonProps {
  onClick?: () => void;
  className?: string;
}

export function GithubLoginButton({ onClick, className }: GithubLoginButtonProps) {
  return (
    <Button
      variant="outline"
      className={cn("w-full flex items-center gap-2", className)}
      onClick={onClick}
    >
      <Github className="w-4 h-4" />
      Continue with GitHub
    </Button>
  );
}
