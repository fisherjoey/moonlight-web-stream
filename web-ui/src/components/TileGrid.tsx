import { ReactNode, useRef } from "react"

/**
 * Console-style tile grid: children marked with `data-tile` become
 * arrow-key navigable (left/right by one, up/down by visual row,
 * Home/End to the edges). Tiles keep their natural tab order.
 */
export function TileGrid({
    children,
    label,
    className = "",
}: {
    children: ReactNode
    label: string
    className?: string
}) {
    const ref = useRef<HTMLDivElement>(null)

    function onKeyDown(event: React.KeyboardEvent) {
        const handled = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]
        if (!handled.includes(event.key)) {
            return
        }
        const grid = ref.current
        if (!grid) {
            return
        }
        const tiles = [...grid.querySelectorAll<HTMLElement>("[data-tile]")]
        if (tiles.length === 0) {
            return
        }
        const active = document.activeElement as HTMLElement | null
        const current = active ? tiles.indexOf(active) : -1
        if (current === -1) {
            return
        }

        // Visual row length: number of tiles sharing the first tile's top edge.
        // (Viewport-relative tops — tiles may live inside positioned wrappers.)
        const firstTop = tiles[0].getBoundingClientRect().top
        const columns = Math.max(
            1,
            tiles.filter(tile => Math.abs(tile.getBoundingClientRect().top - firstTop) < 2).length,
        )

        let next = current
        switch (event.key) {
            case "ArrowLeft":
                next = current - 1
                break
            case "ArrowRight":
                next = current + 1
                break
            case "ArrowUp":
                next = current - columns
                break
            case "ArrowDown":
                next = current + columns
                break
            case "Home":
                next = 0
                break
            case "End":
                next = tiles.length - 1
                break
        }
        if (next < 0 || next >= tiles.length || next === current) {
            return
        }
        event.preventDefault()
        tiles[next].focus()
    }

    return (
        <div
            ref={ref}
            role="grid"
            aria-label={label}
            onKeyDown={onKeyDown}
            className={`flex flex-wrap gap-5 ${className}`}
        >
            {children}
        </div>
    )
}
