"use client"

import { Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface InfoHintProps {
  text: string
}

export function InfoHint({ text }: InfoHintProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9"
            aria-label="Como interpretar este módulo"
          >
            <Info className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs leading-relaxed">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
