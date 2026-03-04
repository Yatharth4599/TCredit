import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

// ══════════════════════════════════════════════════════════════
// useScrollAnimations — replaces IntersectionObserver entirely.
// Targets elements via data-anim="*" attributes so CSS module
// hashes never cause selector mismatches.
// ══════════════════════════════════════════════════════════════

export function useScrollAnimations() {
    useEffect(() => {
        const mm = gsap.matchMedia()

        // Defer setup by one rAF so React has finished painting and
        // all layout dimensions are final before GSAP measures positions.
        let rafId: number

        rafId = requestAnimationFrame(() => {

        // #root is the actual scroll container (clientH=viewport, scrollH=full content).
        // Every ScrollTrigger must target it or it measures zero scroll distance.
        const scroller = document.getElementById('root') ?? undefined
        ScrollTrigger.defaults({ scroller })

        // ── Desktop (≥769px): full animations + pins ──
        mm.add('(min-width: 769px)', () => {

            // ── Cinematic Section — fade up (now after Hero) ──
            const cinematicEl = document.getElementById('cinematic')
            if (cinematicEl) {
                const content = cinematicEl.querySelector('[data-anim="cinematic-content"]')
                if (content) gsap.set(content, { opacity: 0, y: 30 })
                if (content) {
                    gsap.fromTo(content,
                        { opacity: 0, y: 30 },
                        {
                            opacity: 1, y: 0, duration: 0.55, ease: 'power3.out',
                            scrollTrigger: { trigger: cinematicEl, start: 'top 70%', once: true },
                        }
                    )
                }
            }

            // ── Problem Section — pinned; header static, cards fly in ──
            const problemEl = document.getElementById('problem')
            if (problemEl) {
                const cards = Array.from(problemEl.querySelectorAll('[data-anim="problem-card"]'))

                // Cards start off-screen in three directions
                if (cards[0]) gsap.set(cards[0], { opacity: 0, x: -220 })
                if (cards[1]) gsap.set(cards[1], { opacity: 0, y: 160 })
                if (cards[2]) gsap.set(cards[2], { opacity: 0, x: 220 })

                const tl = gsap.timeline({
                    scrollTrigger: {
                        trigger: problemEl,
                        pin: true,
                        start: 'top top',
                        end: '+=70%',
                        scrub: 0.5,
                        anticipatePin: 1,
                    },
                })

                if (cards[0]) {
                    tl.fromTo(cards[0],
                        { opacity: 0, x: -220 },
                        { opacity: 1, x: 0, duration: 0.6, ease: 'power3.out' },
                        0
                    )
                }
                if (cards[1]) {
                    tl.fromTo(cards[1],
                        { opacity: 0, y: 160 },
                        { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' },
                        0.2
                    )
                }
                if (cards[2]) {
                    tl.fromTo(cards[2],
                        { opacity: 0, x: 220 },
                        { opacity: 1, x: 0, duration: 0.6, ease: 'power3.out' },
                        0.4
                    )
                }
            }

            // ── HowItWorks — Pinned horizontal card carousel ──
            const hiwEl = document.getElementById('how-it-works')
            if (hiwEl) {
                const track = hiwEl.querySelector('[data-anim="hiw-track"]') as HTMLElement
                if (track) {
                    const totalScroll = track.scrollWidth - hiwEl.clientWidth

                    gsap.to(track, {
                        x: -totalScroll,
                        ease: 'none',
                        scrollTrigger: {
                            trigger: hiwEl,
                            pin: true,
                            start: 'top top',
                            end: `+=${totalScroll}`,
                            scrub: 0.6,
                            anticipatePin: 1,
                        },
                    })
                }
            }

            // ── Capital Section ──
            const capitalEl = document.getElementById('capital')
            if (capitalEl) {
                const header = capitalEl.querySelector('[data-anim="capital-header"]')
                if (header) gsap.set(header, { opacity: 0, y: 30 })
                if (header) {
                    gsap.fromTo(header,
                        { opacity: 0, y: 30 },
                        {
                            opacity: 1, y: 0, duration: 0.45, ease: 'power3.out',
                            scrollTrigger: { trigger: capitalEl, start: 'top 75%', once: true },
                        }
                    )
                }
            }

            // ── ForUsers — content from left, visual from right ──
            const forUsersEl = document.getElementById('for-users')
            if (forUsersEl) {
                const content = forUsersEl.querySelector('[data-anim="forusers-content"]')
                const visual = forUsersEl.querySelector('[data-anim="forusers-visual"]')
                if (content) gsap.set(content, { opacity: 0, x: -45 })
                if (visual) gsap.set(visual, { opacity: 0, x: 45, scale: 0.96 })
                if (content) {
                    gsap.fromTo(content,
                        { opacity: 0, x: -45 },
                        {
                            opacity: 1, x: 0, duration: 0.4, ease: 'power3.out',
                            scrollTrigger: { trigger: forUsersEl, start: 'top 72%', once: true },
                        }
                    )
                }
                if (visual) {
                    gsap.fromTo(visual,
                        { opacity: 0, x: 45, scale: 0.96 },
                        {
                            opacity: 1, x: 0, scale: 1, duration: 0.4, ease: 'power3.out',
                            scrollTrigger: { trigger: forUsersEl, start: 'top 72%', once: true },
                        }
                    )
                }
            }

            // ── ForMerchants — content from right, visual from left ──
            const forMerchantsEl = document.getElementById('for-merchants')
            if (forMerchantsEl) {
                const content = forMerchantsEl.querySelector('[data-anim="formerchants-content"]')
                const visual = forMerchantsEl.querySelector('[data-anim="formerchants-visual"]')
                if (content) gsap.set(content, { opacity: 0, x: 45 })
                if (visual) gsap.set(visual, { opacity: 0, x: -45, scale: 0.96 })
                if (content) {
                    gsap.fromTo(content,
                        { opacity: 0, x: 45 },
                        {
                            opacity: 1, x: 0, duration: 0.4, ease: 'power3.out',
                            scrollTrigger: { trigger: forMerchantsEl, start: 'top 72%', once: true },
                        }
                    )
                }
                if (visual) {
                    gsap.fromTo(visual,
                        { opacity: 0, x: -45, scale: 0.96 },
                        {
                            opacity: 1, x: 0, scale: 1, duration: 0.4, ease: 'power3.out',
                            scrollTrigger: { trigger: forMerchantsEl, start: 'top 72%', once: true },
                        }
                    )
                }
            }

            // ── Flywheel Section — PINNED scroll-driven card reveal + floating after ──
            const flywheelEl = document.getElementById('flywheel')
            if (flywheelEl) {
                const mainCards = Array.from(flywheelEl.querySelectorAll('[data-anim="flywheel-card"]'))
                const accentCards = Array.from(flywheelEl.querySelectorAll('[data-anim="flywheel-accent"]'))
                const allCards = [...accentCards, ...mainCards]
                const centerText = flywheelEl.querySelector('[data-anim="flywheel-center"]')

                gsap.set(mainCards, { opacity: 0, y: 60, scale: 0.88 })
                gsap.set(accentCards, { opacity: 0, y: 30, scale: 0.9 })
                if (centerText) gsap.set(centerText, { opacity: 0, y: 30, scale: 0.95 })

                const tl = gsap.timeline({
                    scrollTrigger: {
                        trigger: flywheelEl,
                        pin: true,
                        start: 'top top',
                        end: '+=100%',
                        scrub: 0.5,
                        onLeave: () => {
                            allCards.forEach((card) => {
                                (card as HTMLElement).dataset.floating = 'true'
                            })
                        },
                        onEnterBack: () => {
                            allCards.forEach((card) => {
                                delete (card as HTMLElement).dataset.floating
                            })
                        },
                    },
                })

                accentCards.forEach((card, i) => {
                    tl.fromTo(
                        card,
                        { opacity: 0, y: 30, scale: 0.9 },
                        { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: 'power2.out' },
                        i * 0.06,
                    )
                })

                mainCards.forEach((card, i) => {
                    tl.fromTo(
                        card,
                        { opacity: 0, y: 60, scale: 0.88 },
                        { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'power3.out' },
                        accentCards.length * 0.05 + i * 0.2,
                    )
                })

                if (centerText) {
                    tl.fromTo(
                        centerText,
                        { opacity: 0, y: 30, scale: 0.95 },
                        { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'power3.out' },
                        accentCards.length * 0.05 + mainCards.length * 0.15,
                    )
                }
            }

            // ── WhyBlockchain ──
            const whyEl = document.getElementById('why-blockchain')
            if (whyEl) {
                const text = whyEl.querySelector('[data-anim="why-text"]')
                if (text) gsap.set(text, { opacity: 0, y: 30 })
                if (text) {
                    gsap.fromTo(text,
                        { opacity: 0, y: 30 },
                        {
                            opacity: 1, y: 0, duration: 0.45, ease: 'power3.out',
                            scrollTrigger: { trigger: whyEl, start: 'top 72%', once: true },
                        }
                    )
                }
            }

        })

        // ── Mobile (<769px): lightweight fade-up for all animated elements ──
        mm.add('(max-width: 768px)', () => {
            document.querySelectorAll('[data-anim]').forEach(el => {
                gsap.fromTo(el,
                    { opacity: 0, y: 20 },
                    {
                        opacity: 1, y: 0, duration: 0.4, ease: 'power3.out',
                        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
                    }
                )
            })
        })

        // Recalculate all trigger positions after final layout
        ScrollTrigger.refresh()

        }) // end requestAnimationFrame

        return () => {
            cancelAnimationFrame(rafId)
            mm.revert()
        }
    }, [])
}
