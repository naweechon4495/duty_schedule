"use client";

import { Tabs as T } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Tabs = T.Root;

/** แถบแท็บแบบ segmented — เลื่อนแนวนอนได้บนจอแคบ */
export function TabsList({ className, ...props }: React.ComponentProps<typeof T.List>) {
  return <T.List className={cn("flex w-full gap-1 overflow-x-auto rounded-xl bg-canvas p-1 [scrollbar-width:none]", className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof T.Trigger>) {
  return (
    <T.Trigger
      className={cn(
        "inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold whitespace-nowrap text-ink-soft transition-colors hover:text-ink data-[state=active]:bg-surface data-[state=active]:text-brand-800 data-[state=active]:shadow-sm [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}

export const TabsContent = ({ className, ...props }: React.ComponentProps<typeof T.Content>) => (
  <T.Content className={cn("mt-4 outline-none", className)} {...props} />
);
