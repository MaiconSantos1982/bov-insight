import * as React from "react";

import { Widget, WidgetContent } from "@/components/ui/widget";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";

export type StockItem = {
  key: string;
  title: string;
  price: number;
  unit: string;
  icon: React.ReactNode;
};

export default function MobileStockWidget({ items, className }: { items: StockItem[], className?: string }) {
  return (
    <TooltipProvider>
      <Widget className={cn("h-auto", className)} size="sm">
        <WidgetContent className="items-center py-6 px-4">
          <div className="grid size-full grid-cols-2 items-center gap-y-8 gap-x-4">
            {items.map((item) => (
              <Tooltip delayDuration={300} key={item.key}>
                <TooltipTrigger asChild>
                  <div className="flex flex-col items-center justify-center gap-1 cursor-default">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                      {item.icon}
                    </div>
                    <Label className="text-[13px] font-bold tracking-tight">
                      R${item.price.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </Label>
                    <span className="text-[9px] text-muted-foreground uppercase font-medium tracking-wider">
                      {item.unit}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{item.title}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </WidgetContent>
      </Widget>
    </TooltipProvider>
  );
}
