import type { SVGProps } from "react"

/*
 * Minimal 24px stroke icon set, drawn inline so the app has zero icon
 * dependencies. All icons inherit `currentColor`.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function base({ size = 20, ...props }: IconProps): SVGProps<SVGSVGElement> {
    return {
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.7,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": true,
        ...props,
    }
}

export function IconMonitor(props: IconProps) {
    return (
        <svg {...base(props)}>
            <rect x="2.5" y="4" width="19" height="13" rx="2.5" />
            <path d="M9 21h6M12 17.5V21" />
        </svg>
    )
}

export function IconLock(props: IconProps) {
    return (
        <svg {...base(props)}>
            <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
            <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
        </svg>
    )
}

export function IconZap(props: IconProps) {
    return (
        <svg {...base(props)}>
            <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H13L13 2Z" />
        </svg>
    )
}

export function IconRefresh(props: IconProps) {
    return (
        <svg {...base(props)}>
            <path d="M20 11a8 8 0 1 0-1.2 5.3" />
            <path d="M20 5.5V11h-5.5" />
        </svg>
    )
}

export function IconTrash(props: IconProps) {
    return (
        <svg {...base(props)}>
            <path d="M4 6.5h16M9.5 6.5V4.8A1.3 1.3 0 0 1 10.8 3.5h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7" />
            <path d="M6.5 6.5 7.3 19a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9l.8-12.5" />
            <path d="M10 10.5v6M14 10.5v6" />
        </svg>
    )
}

export function IconGlobe(props: IconProps) {
    return (
        <svg {...base(props)}>
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3a14.5 14.5 0 0 1 0 18M12 3a14.5 14.5 0 0 0 0 18" />
        </svg>
    )
}

export function IconUser(props: IconProps) {
    return (
        <svg {...base(props)}>
            <circle cx="12" cy="8" r="4" />
            <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
        </svg>
    )
}

export function IconDots(props: IconProps) {
    return (
        <svg {...base(props)} fill="currentColor" stroke="none">
            <circle cx="5" cy="12" r="1.7" />
            <circle cx="12" cy="12" r="1.7" />
            <circle cx="19" cy="12" r="1.7" />
        </svg>
    )
}

export function IconPlay(props: IconProps) {
    return (
        <svg {...base(props)}>
            <path d="M7 4.8v14.4L19 12 7 4.8Z" />
        </svg>
    )
}

export function IconStop(props: IconProps) {
    return (
        <svg {...base(props)}>
            <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
    )
}

export function IconX(props: IconProps) {
    return (
        <svg {...base(props)}>
            <path d="M6 6l12 12M18 6 6 18" />
        </svg>
    )
}

export function IconCheck(props: IconProps) {
    return (
        <svg {...base(props)}>
            <path d="m4.5 12.5 5 5L19.5 7" />
        </svg>
    )
}

export function IconAlert(props: IconProps) {
    return (
        <svg {...base(props)}>
            <path d="M12 3.5 2.5 20h19L12 3.5Z" />
            <path d="M12 10v4.5M12 17.6v.01" />
        </svg>
    )
}

export function IconPlus(props: IconProps) {
    return (
        <svg {...base(props)}>
            <path d="M12 5v14M5 12h14" />
        </svg>
    )
}

export function IconArrowLeft(props: IconProps) {
    return (
        <svg {...base(props)}>
            <path d="M19 12H5M11.5 5.5 5 12l6.5 6.5" />
        </svg>
    )
}

export function IconSignOut(props: IconProps) {
    return (
        <svg {...base(props)}>
            <path d="M14 4h-7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7" />
            <path d="M10 12h10.5M17 8l3.5 4-3.5 4" />
        </svg>
    )
}

/** The brand mark: a waning crescent with a soft halo. */
export function MoonMark({ size = 28, glow = true }: { size?: number; glow?: boolean }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 32 32"
            aria-hidden
            style={glow ? { filter: "drop-shadow(0 0 10px rgba(122,162,255,0.55))" } : undefined}
        >
            <path
                d="M21.5 4.5a12.4 12.4 0 1 0 6 21.6A13.4 13.4 0 0 1 21.5 4.5Z"
                fill="var(--color-moon)"
            />
            <circle cx="16" cy="16" r="15" fill="none" stroke="var(--color-moon)" strokeOpacity="0.18" />
        </svg>
    )
}
