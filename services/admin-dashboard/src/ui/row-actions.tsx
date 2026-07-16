// src/ui/row-actions.tsx
import * as React from "react";
import Link from "next/link";
import { MoreVertical, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/src/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/src/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/src/ui/tooltip";

/**
 * Shared table row-action column: one or two compact icon buttons for the
 * primary action(s), plus a kebab overflow menu for everything else. See
 * `app/programs/[programId]/payments/page.tsx` for the reference usage.
 */

export interface RowAction {
  label: string;
  icon?: LucideIcon;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** Menu items only — applies destructive (red) styling. */
  destructive?: boolean;
}

export interface RowActionsProps {
  /** Compact icon buttons, each wrapped in a tooltip showing `label`. */
  primary?: RowAction[];
  /** Items rendered inside the kebab overflow menu. */
  menu?: RowAction[];
}

function PrimaryActionButton({ action }: { action: RowAction }) {
  const Icon = action.icon;
  const content = (
    <>
      {Icon && <Icon className="h-4 w-4" />}
      <span className="sr-only">{action.label}</span>
    </>
  );
  const className = "h-8 w-8 text-zinc-500 hover:text-zinc-900";

  const button = action.href ? (
    <Button asChild variant="ghost" size="icon" className={className} disabled={action.disabled}>
      <Link href={action.href} aria-label={action.label}>
        {content}
      </Link>
    </Button>
  ) : (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={className}
      disabled={action.disabled}
      aria-label={action.label}
      onClick={action.onClick}
    >
      {content}
    </Button>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{action.label}</TooltipContent>
    </Tooltip>
  );
}

function MenuActionItem({ action }: { action: RowAction }) {
  const Icon = action.icon;
  const className = cn(action.destructive && "text-red-600 focus:text-red-600");

  if (action.href) {
    return (
      <DropdownMenuItem asChild disabled={action.disabled} className={className}>
        <Link href={action.href}>
          {Icon && <Icon className="mr-2 h-4 w-4" />}
          {action.label}
        </Link>
      </DropdownMenuItem>
    );
  }

  return (
    <DropdownMenuItem disabled={action.disabled} onClick={action.onClick} className={className}>
      {Icon && <Icon className="mr-2 h-4 w-4" />}
      {action.label}
    </DropdownMenuItem>
  );
}

export function RowActions({ primary = [], menu = [] }: RowActionsProps) {
  return (
    <div className="flex items-center justify-end gap-1">
      {primary.map((action) => (
        <PrimaryActionButton key={action.label} action={action} />
      ))}

      {menu.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-zinc-500 hover:text-zinc-900"
              aria-label="More actions"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {menu.map((action) => (
              <MenuActionItem key={action.label} action={action} />
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
