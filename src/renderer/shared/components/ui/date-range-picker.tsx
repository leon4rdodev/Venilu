

import * as React from "react"
import { CalendarIcon, Check } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import type { DateRange } from "react-day-picker"
import { cn } from "@lib/utils"
import { Button } from "@components/ui/button"
import { Calendar } from "@components/ui/calendar"

interface DateRangePickerProps {
    dateRange: DateRange
    onDateRangeChange: (range: DateRange | undefined) => void
    className?: string
}

export function DateRangePicker({
    dateRange,
    onDateRangeChange,
    className,
}: DateRangePickerProps) {
    const [isOpen, setIsOpen] = React.useState(false)
    const containerRef = React.useRef<HTMLDivElement>(null)
    const dropdownRef = React.useRef<HTMLDivElement>(null)

    // Pending selection — only applied when user clicks "Aplicar"
    const [pendingRange, setPendingRange] = React.useState<DateRange>(dateRange)

    // Sync pending range when the calendar opens
    React.useEffect(() => {
        if (isOpen) {
            setPendingRange(dateRange)
        }
    }, [isOpen])

    // Close dropdown when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false)
            }
        }

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside)
            return () => {
                document.removeEventListener("mousedown", handleClickOutside)
            }
        }
    }, [isOpen])

    // Close on Escape key
    React.useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsOpen(false)
            }
        }

        if (isOpen) {
            document.addEventListener("keydown", handleEscape)
            return () => {
                document.removeEventListener("keydown", handleEscape)
            }
        }
    }, [isOpen])

    const handleDateSelect = (range: DateRange | undefined) => {
        if (range) {
            setPendingRange(range)
        }
    }

    const handleApply = () => {
        onDateRangeChange(pendingRange)
        setIsOpen(false)
    }

    const canApply = pendingRange.from && pendingRange.to

    const displayDateRange =
        dateRange.from && dateRange.to
            ? `${format(dateRange.from, "PPP", { locale: es })} - ${format(dateRange.to, "PPP", { locale: es })}`
            : "Seleccionar rango de fechas"

    return (
        <div ref={containerRef} className={cn("relative", className)}>
            <Button
                variant="outline"
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "w-full justify-start text-left font-normal rounded-md",
                    !dateRange.from && "text-muted-foreground"
                )}
            >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {displayDateRange}
            </Button>

            {isOpen && (
                <>
                    {/* Backdrop */}
                    <button
                        type="button"
                        aria-label="Cerrar selector de fechas"
                        className="fixed inset-0 z-[9998] bg-black/20 cursor-default"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Dropdown */}
                    <div
                        ref={dropdownRef}
                        className={cn(
                            "absolute right-0 top-full mt-2 z-[9999]",
                            "bg-popover text-popover-foreground rounded-md border shadow-md overflow-hidden",
                            "animate-in fade-in-0 zoom-in-95 slide-in-from-top-2",
                            "p-0"
                        )}
                        style={{
                            minWidth: "max-content",
                        }}
                    >
                        <Calendar
                            mode="range"
                            defaultMonth={dateRange.from}
                            selected={pendingRange}
                            onSelect={handleDateSelect}
                            numberOfMonths={2}
                            locale={es}
                        />
                        <div className="border-t border-border px-4 py-3 flex items-center justify-end gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsOpen(false)}
                            >
                                Cancelar
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleApply}
                                disabled={!canApply}
                                className="gap-1.5"
                            >
                                <Check className="h-3.5 w-3.5" />
                                Aplicar
                            </Button>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
