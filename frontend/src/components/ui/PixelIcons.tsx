import React from 'react'

interface PixelIconProps {
    className?: string
    style?: React.CSSProperties
    opacity?: number
}

// Helper: render a 32x32 grid from row strings
// Each character maps to a color via the palette
function renderGrid(rows: string[], palette: Record<string, string>, cellSize = 4) {
    const rects: React.ReactElement[] = []
    for (let y = 0; y < rows.length; y++) {
        for (let x = 0; x < rows[y].length; x++) {
            const ch = rows[y][x]
            if (ch === '.' || !palette[ch]) continue
            rects.push(
                <rect
                    key={`${x}-${y}`}
                    x={x * cellSize}
                    y={y * cellSize}
                    width={cellSize}
                    height={cellSize}
                    fill={palette[ch]}
                />
            )
        }
    }
    return rects
}

// ═══════════════════════════════════════
// ICON 1: BANK (Traditional Finance)
// Classical Greek temple with columns
// ═══════════════════════════════════════
const BANK_PALETTE: Record<string, string> = {
    'B': '#000000',  // Black outline
    'L': '#7DFFD4',  // Light cyan highlight
    'M': '#3DCFB4',  // Mid teal main
    'D': '#1A9E8A',  // Dark teal shadow
    'S': '#0D6B5E',  // Deep shadow
}

// 32x32 grid
const BANK_ROWS = [
    '................................',
    '................................',
    '................................',
    '...............BB...............',
    '..............BLLB..............',
    '.............BLLLLB.............',
    '............BLLMMLLB............',
    '...........BLMMMMMMLB..........',
    '..........BLMMMMMMMMBLB........',
    '.........BLMMMMMMMMMMLB........',
    '........BLMMMMMMMMMMMMMLB......',
    '.......BLMMMMMMMMMMMMMMLB.....',
    '......BLMMMMMMMMMMMMMMMMMLB....',
    '.....BBBBBBBBBBBBBBBBBBBBBB....',
    '.....BDDDDDDDDDDDDDDDDDDDB....',
    '.....BBBBBBBBBBBBBBBBBBBBBB....',
    '.....BLB.BLB..BLB..BLB.BLB....',
    '.....BMB.BMB..BMB..BMB.BMB....',
    '.....BMB.BMB..BMB..BMB.BMB....',
    '.....BMB.BMB..BMB..BMB.BMB....',
    '.....BMB.BMB.BSSB..BMB.BMB....',
    '.....BMB.BMB.BSSB..BMB.BMB....',
    '.....BMB.BMB.BSSB..BMB.BMB....',
    '.....BMB.BMB.BSSB..BMB.BMB....',
    '.....BDB.BDB.BSSB..BDB.BDB....',
    '.....BDB.BDB.BSSB..BDB.BDB....',
    '.....BBBBBBBBBBBBBBBBBBBBBB....',
    '.....BMMMMMMMMMMMMMMMMMMMMB....',
    '.....BDDDDDDDDDDDDDDDDDDDB....',
    '.....BBBBBBBBBBBBBBBBBBBBBB....',
    '................................',
    '................................',
]

export function BankIcon({ className, style, opacity = 1 }: PixelIconProps) {
    return (
        <svg
            viewBox="0 0 128 128"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            style={{ ...style, opacity }}
            shapeRendering="crispEdges"
        >
            {renderGrid(BANK_ROWS, BANK_PALETTE)}
        </svg>
    )
}

// ═══════════════════════════════════════
// ICON 2: HOURGLASS (DeFi Today)
// Hourglass with sand flowing
// ═══════════════════════════════════════
const HOURGLASS_PALETTE: Record<string, string> = {
    'B': '#000000',  // Black outline
    'L': '#FFB86C',  // Light orange (glass/empty)
    'M': '#FF8C42',  // Mid orange (sand surface)
    'D': '#D4621A',  // Dark orange (sand depth)
    'S': '#8B3E0F',  // Shadow (frame caps)
}

const HOURGLASS_ROWS = [
    '................................',
    '................................',
    '......BBBBBBBBBBBBBBBBBB........',
    '......BSSSSSSSSSSSSSSSSB........',
    '......BBBBBBBBBBBBBBBBBB........',
    '.......BLLLLLLLLLLLLLLLB........',
    '........BLLLLLLLLLLLLB..........',
    '........BLLLLLLLLLLLLB..........',
    '.........BLLLLLLLLLLB..........',
    '.........BLLLLLMMLLB...........',
    '..........BLLMMMMLB............',
    '..........BLMMMMMLB............',
    '...........BMMMMMB.............',
    '...........BMDDDMB.............',
    '............BDDDB..............',
    '............BDDDB..............',
    '.............BBB................',
    '.............BMB................',
    '............BLLDB..............',
    '............BLLDB..............',
    '...........BLLLDB..............',
    '...........BLLLDDB.............',
    '..........BLLLLDDB.............',
    '..........BLLLLDDDB............',
    '.........BLLLLLDDDB............',
    '.........BLLLLMDDDDB...........',
    '........BLLLLMMDDDDDB..........',
    '........BLLLMMMMDDDDB..........',
    '.......BLLMMMMMMMDDDB..........',
    '......BBBBBBBBBBBBBBBBBB........',
    '......BSSSSSSSSSSSSSSSSB........',
    '......BBBBBBBBBBBBBBBBBB........',
]

export function HourglassIcon({ className, style, opacity = 1 }: PixelIconProps) {
    return (
        <svg
            viewBox="0 0 128 128"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            style={{ ...style, opacity }}
            shapeRendering="crispEdges"
        >
            {renderGrid(HOURGLASS_ROWS, HOURGLASS_PALETTE)}
        </svg>
    )
}

// ═══════════════════════════════════════
// ICON 3: BROKEN SHIELD (No Enforcement)
// Shield with vertical crack
// ═══════════════════════════════════════
const SHIELD_PALETTE: Record<string, string> = {
    'B': '#000000',  // Black outline / crack
    'L': '#FF7EB3',  // Light pink highlight
    'M': '#E6457A',  // Mid magenta main
    'D': '#B8255A',  // Dark magenta shadow
    'S': '#7A1038',  // Deep shadow (crack edges)
    'X': '#303030',  // Debris
}

const SHIELD_ROWS = [
    '................................',
    '................................',
    '.....BBBBBBBBB..BBBBBBBBB.......',
    '....BLLLLLLLLB..BMMMMMMMMB......',
    '...BLLLLLLLLLB..BMMMMMMMMMB.....',
    '...BLLLLLLLLB....BMMMMMMMMB.....',
    '..BLLLLLLLLLB....BMMMMMMMMMB....',
    '..BLLLMMMMMLB..X.BDMMMMMMMMB....',
    '..BLMMMMMMMLB....BDDMMMMMMDB....',
    '..BLMMMMMMMLB....BDDMMMMMDB....',
    '..BMMMMMMMMB......BDMMMMMDB....',
    '..BMMMMMMMMB......BDMMMMMDB....',
    '..BMMMMSMMB........BMMMMMDB....',
    '..BMMMMBMMB........BMMMMDDB....',
    '...BMMMBMMB........BMMMDDB.....',
    '...BMMMMBMB.......BMMMDDDB.....',
    '...BMMMMBB.........BMMDDDB.....',
    '....BMMMB...X......BMMDDB......',
    '....BMMMBB........BMMDDDB......',
    '....BMMMMBB......BMMDDDB.......',
    '.....BMMMMMB....BMMDDDDB.......',
    '.....BMMMMMMB..BMMDDDDDB.......',
    '......BMMMMMMBBMMDDDDDB........',
    '......BMMMMMMBBMDDDDDB.........',
    '.......BMMMMMBBMDDDDB..........',
    '........BMMMMBBMDDDB...........',
    '.........BMMMBBMDDB............',
    '..........BMMBBMDB.............',
    '...........BMBBDB..............',
    '............BBBB...............',
    '.............BB.................',
    '................................',
]

export function ShieldIcon({ className, style, opacity = 1 }: PixelIconProps) {
    return (
        <svg
            viewBox="0 0 128 128"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            style={{ ...style, opacity }}
            shapeRendering="crispEdges"
        >
            {renderGrid(SHIELD_ROWS, SHIELD_PALETTE)}
        </svg>
    )
}
