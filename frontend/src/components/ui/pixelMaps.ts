/**
 * Pixel map data for PixelCanvas component.
 * Each row is an array of hex color strings or null (transparent).
 *
 * White tiger face pixel art — 64x64 high-detail:
 * - White/silver fur with black stripes
 * - Cyan ice-blue eyes
 * - Pink nose with dark nostrils
 * - Cream/beige muzzle area
 * - Pink inner ears
 * - Blue-gray shadow tones on cheeks/jaw
 * - Subtle warm/cool accents at chin edge
 */

const O = '#F0F2F5' // white fur (main body)
const D = '#C8CCD4' // silver shadow fur
// G is used sparingly for deep cheek shadows
const G = '#A8ADB8' // deeper gray shadow
const B = '#1A1A1A' // black (outline, stripes, pupils)
const K = '#333333' // dark gray (stripe edges, eyelids)
const W = '#FFFFFF' // pure white (muzzle highlights)
const C = '#E8DDD0' // cream (muzzle transition)
const E = '#D5C8B8' // warm beige
const P = '#D47070' // pink (nose, inner ear)
const N = '#C05555' // deep pink (nostril, mouth)
const A = '#22D3EE' // cyan ice-blue (eye iris)
const T = '#0EA5E9' // deeper cyan (eye shadow)
const S = '#8BA4B8' // steel blue (cheek shadow)
const L = '#B0BCC8' // light steel
const _ = null      // transparent

// 64x64 detailed white tiger head
export const TIGER_PIXEL_MAP: (string | null)[][] = [
// Row 0-3: ear tips
[_,_,_,_,_,_,_,_,_,_,B,B,B,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,B,B,B,_,_,_,_,_,_,_,_,_,_],
[_,_,_,_,_,_,_,_,_,B,K,D,D,B,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,B,D,D,K,B,_,_,_,_,_,_,_,_,_],
[_,_,_,_,_,_,_,_,B,D,O,O,O,D,B,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,B,D,O,O,O,D,B,_,_,_,_,_,_,_,_],
[_,_,_,_,_,_,_,B,D,O,O,O,O,O,D,B,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,B,D,O,O,O,O,O,D,B,_,_,_,_,_,_,_],
// Row 4-7: ears with pink inner
[_,_,_,_,_,_,B,D,O,O,O,P,P,O,O,D,B,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,B,D,O,O,P,P,O,O,D,B,_,_,_,_,_,_,_],
[_,_,_,_,_,B,D,O,O,O,P,P,P,P,O,O,D,B,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,B,D,O,O,P,P,P,P,O,O,D,B,_,_,_,_,_,_],
[_,_,_,_,B,D,O,O,O,P,P,P,P,P,P,O,O,D,B,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,B,D,O,O,P,P,P,P,P,P,O,O,D,B,_,_,_,_,_],
[_,_,_,B,D,O,O,O,O,P,P,P,P,P,O,O,O,O,D,B,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,B,D,O,O,O,P,P,P,P,P,O,O,O,O,D,B,_,_,_,_],
// Row 8-9: ears connect to head
[_,_,B,D,O,O,O,O,O,O,P,P,O,O,O,O,O,O,O,B,B,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,B,B,O,O,O,O,O,P,P,O,O,O,O,O,O,D,B,_,_,_,_],
[_,_,B,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,B,_,_,_,_],
// Row 10-13: forehead with tiger stripes
[_,_,_,B,O,O,O,O,B,B,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,B,B,B,B,B,B,B,B,B,B,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,B,B,O,O,O,O,B,_,_,_,_,_],
[_,_,_,B,O,O,O,B,K,K,B,O,O,O,O,O,O,O,O,O,O,O,O,B,B,O,O,O,O,O,O,O,O,O,O,O,O,B,B,O,O,O,O,O,O,O,O,O,O,O,B,K,K,B,O,O,O,O,B,_,_,_,_,_],
[_,_,_,_,B,O,O,B,B,K,K,B,O,O,O,O,O,O,O,O,O,O,B,K,K,B,O,O,O,O,O,O,O,O,O,O,O,O,B,K,K,B,O,O,O,O,O,O,O,B,K,K,B,B,O,O,O,B,_,_,_,_,_,_],
[_,_,_,_,B,O,O,O,B,B,K,K,B,O,O,O,O,O,O,O,O,B,K,B,B,K,B,O,O,O,O,O,O,O,O,O,O,B,K,B,B,K,B,O,O,O,O,O,B,K,K,B,B,O,O,O,O,B,_,_,_,_,_,_],
// Row 14-17: deeper forehead stripes
[_,_,_,_,_,B,O,O,O,B,B,K,K,B,O,O,O,O,O,O,B,K,B,O,O,B,K,B,O,O,O,O,O,O,O,O,O,B,K,O,O,B,K,B,O,O,O,B,K,K,B,B,O,O,O,O,B,_,_,_,_,_,_,_],
[_,_,_,_,_,B,O,O,O,O,B,B,K,B,O,O,O,O,O,B,K,B,O,O,O,O,B,K,B,O,O,O,O,O,O,O,B,K,B,O,O,O,B,K,B,O,O,B,K,B,B,O,O,O,O,O,B,_,_,_,_,_,_,_],
[_,_,_,_,_,_,B,O,O,O,O,B,B,B,O,O,O,O,O,B,K,O,O,O,O,O,O,B,B,O,O,O,O,O,O,B,B,O,O,O,O,O,O,K,B,O,O,B,B,B,O,O,O,O,O,B,_,_,_,_,_,_,_,_],
[_,_,_,_,_,_,B,O,O,O,O,O,B,B,B,O,O,O,O,O,B,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,B,O,O,O,B,B,O,O,O,O,O,O,B,_,_,_,_,_,_,_,_],
// Row 18-19: brow ridge
[_,_,_,_,_,B,O,O,O,O,O,O,O,B,B,B,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,B,B,B,O,O,O,O,O,O,O,B,_,_,_,_,_,_,_],
[_,_,_,_,B,O,O,O,O,O,O,O,O,O,B,B,B,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,B,B,B,O,O,O,O,O,O,O,O,O,B,_,_,_,_,_,_],
// Row 20-21: upper eyelids
[_,_,_,_,B,O,O,O,O,O,B,B,B,B,B,B,B,B,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,B,B,B,B,B,B,B,B,O,O,O,O,O,B,_,_,_,_,_,_],
[_,_,_,B,O,O,O,O,O,B,K,K,K,K,K,K,K,B,B,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,B,B,K,K,K,K,K,K,K,B,O,O,O,O,O,O,B,_,_,_,_,_],
// Row 22-25: eyes (white, cyan iris, dark pupil)
[_,_,_,B,O,O,O,O,B,W,W,W,A,A,A,T,K,K,B,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,B,K,K,T,A,A,A,W,W,W,B,O,O,O,O,O,B,_,_,_,_,_],
[_,_,_,B,O,O,O,B,W,W,W,A,A,A,T,B,B,K,B,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,B,K,B,B,T,A,A,A,W,W,W,B,O,O,O,O,B,_,_,_,_,_],
[_,_,_,B,O,O,O,B,W,W,A,A,A,T,B,B,K,K,B,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,B,K,K,B,B,T,A,A,A,W,W,B,O,O,O,O,B,_,_,_,_,_],
[_,_,_,B,O,O,O,B,W,W,A,A,T,T,B,K,K,B,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,B,K,K,B,T,T,A,A,W,W,B,O,O,O,O,B,_,_,_,_,_],
// Row 26-27: lower eyes
[_,_,_,B,O,O,O,O,B,W,W,A,A,T,K,K,B,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,B,K,K,T,A,A,W,W,B,O,O,O,O,O,B,_,_,_,_,_],
[_,_,_,_,B,O,O,O,O,B,W,W,A,K,K,B,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,B,K,K,A,W,W,B,O,O,O,O,O,B,_,_,_,_,_,_],
// Row 28-29: lower eyelids
[_,_,_,_,B,O,O,O,O,O,B,B,B,B,B,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,B,B,B,B,B,O,O,O,O,O,O,B,_,_,_,_,_,_],
[_,_,_,_,B,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,B,_,_,_,_,_,_],
// Row 30-31: cheek stripes begin, nose bridge starts
[_,_,_,_,B,O,B,B,K,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,C,C,C,C,C,C,C,C,C,C,C,C,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,K,B,B,O,O,B,_,_,_,_,_,_],
[_,_,_,_,B,O,O,B,K,K,B,O,O,O,O,O,O,O,O,O,O,O,O,O,C,C,C,C,E,E,E,E,E,E,C,C,C,C,O,O,O,O,O,O,O,O,O,O,O,O,B,K,K,B,O,O,O,B,_,_,_,_,_,_],
// Row 32-33: nose bridge
[_,_,_,_,_,B,O,O,B,K,K,B,O,O,O,O,O,O,O,O,O,O,O,C,C,C,E,E,E,E,E,E,E,E,E,E,C,C,C,O,O,O,O,O,O,O,O,O,O,B,K,K,B,O,O,O,B,_,_,_,_,_,_,_],
[_,_,_,_,_,B,O,O,O,B,K,B,O,O,O,O,O,O,O,O,O,O,C,C,E,E,E,C,C,C,C,C,C,C,C,E,E,E,C,C,O,O,O,O,O,O,O,O,B,K,B,O,O,O,O,O,B,_,_,_,_,_,_,_],
// Row 34-35: nose
[_,_,_,_,_,_,B,O,O,O,B,B,O,O,O,O,O,O,O,O,O,C,C,E,E,P,P,P,P,P,P,P,P,P,P,P,P,E,E,C,C,O,O,O,O,O,O,O,B,B,O,O,O,O,O,B,_,_,_,_,_,_,_,_],
[_,_,_,_,_,_,B,O,O,O,O,B,O,O,O,O,O,O,O,O,C,C,E,P,P,P,P,P,P,P,P,P,P,P,P,P,P,P,E,C,C,O,O,O,O,O,O,O,B,O,O,O,O,O,O,B,_,_,_,_,_,_,_,_],
// Row 36-37: nostrils
[_,_,_,_,_,_,_,B,O,O,O,O,B,O,O,O,O,O,O,O,C,E,P,P,N,B,B,N,P,P,P,P,P,P,N,B,B,N,P,P,E,C,O,O,O,O,O,O,B,O,O,O,O,O,B,_,_,_,_,_,_,_,_,_],
[_,_,_,_,_,_,_,B,O,O,O,O,O,B,O,O,O,O,O,C,E,P,P,N,B,K,K,B,N,P,P,P,P,N,B,K,K,B,N,P,P,E,C,O,O,O,O,B,O,O,O,O,O,O,B,_,_,_,_,_,_,_,_,_],
// Row 38-39: upper muzzle
[_,_,_,_,_,_,_,B,O,O,O,O,O,O,B,O,O,O,O,C,E,C,C,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,C,C,E,C,O,O,O,B,O,O,O,O,O,O,O,B,_,_,_,_,_,_,_,_,_],
[_,_,_,_,_,_,_,_,B,O,O,O,O,O,O,B,O,O,C,C,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,C,C,O,B,O,O,O,O,O,O,O,B,_,_,_,_,_,_,_,_,_,_],
// Row 40-41: muzzle
[_,_,_,_,_,_,_,_,B,O,O,O,O,O,O,O,B,O,C,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,C,B,O,O,O,O,O,O,O,O,B,_,_,_,_,_,_,_,_,_,_],
[_,_,_,_,_,_,_,_,_,B,O,O,O,O,O,O,B,C,W,W,W,W,W,W,W,W,W,C,C,C,C,C,C,C,W,W,W,W,W,W,W,W,W,C,B,O,O,O,O,O,O,O,B,_,_,_,_,_,_,_,_,_,_,_],
// Row 42-43: mouth
[_,_,_,_,_,_,_,_,_,B,O,O,O,O,O,O,O,C,W,W,W,W,W,C,C,C,B,B,B,B,B,B,B,B,C,C,C,W,W,W,W,W,C,O,O,O,O,O,O,O,O,O,B,_,_,_,_,_,_,_,_,_,_,_],
[_,_,_,_,_,_,_,_,_,_,B,O,O,O,O,O,O,O,C,W,W,C,C,N,N,B,B,K,K,K,K,K,K,B,B,N,N,C,C,W,W,C,O,O,O,O,O,O,O,O,O,B,_,_,_,_,_,_,_,_,_,_,_,_],
// Row 44-45: lower mouth / chin
[_,_,_,_,_,_,_,_,_,_,B,O,O,O,O,O,O,O,O,C,C,C,C,C,C,B,K,P,P,P,P,P,P,K,B,C,C,C,C,C,C,O,O,O,O,O,O,O,O,O,O,B,_,_,_,_,_,_,_,_,_,_,_,_],
[_,_,_,_,_,_,_,_,_,_,_,B,O,O,O,O,O,O,O,O,C,C,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,C,C,O,O,O,O,O,O,O,O,O,O,O,B,_,_,_,_,_,_,_,_,_,_,_,_,_],
// Row 46-47: chin
[_,_,_,_,_,_,_,_,_,_,_,B,O,O,O,O,O,O,O,O,O,C,C,W,W,W,W,W,W,W,W,W,W,W,W,C,C,O,O,O,O,O,O,O,O,O,O,O,O,O,B,_,_,_,_,_,_,_,_,_,_,_,_,_],
[_,_,_,_,_,_,_,_,_,_,_,_,B,O,O,O,O,D,O,O,O,O,O,C,C,C,W,W,W,W,W,W,W,W,C,C,O,O,O,O,O,D,O,O,O,O,O,O,O,B,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
// Row 48-49: lower chin with shadow tones
[_,_,_,_,_,_,_,_,_,_,_,_,B,O,O,O,D,D,O,O,O,O,O,O,C,C,C,C,C,C,C,C,C,C,C,O,O,O,O,O,O,D,D,O,O,O,O,O,O,B,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
[_,_,_,_,_,_,_,_,_,_,_,_,_,B,O,O,O,D,D,O,O,O,O,O,O,O,C,C,C,C,C,C,C,C,O,O,O,O,O,O,D,D,O,O,O,O,O,O,B,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
// Row 50-51: jaw with steel-blue shadows
[_,_,_,_,_,_,_,_,_,_,_,_,_,_,B,O,O,O,D,D,S,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,O,S,D,D,O,O,O,O,O,O,B,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
[_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,B,O,O,O,D,S,S,L,O,O,O,O,O,O,O,O,O,O,O,O,O,O,L,S,S,D,O,O,O,O,O,B,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
// Row 52-53: lower jaw
[_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,B,O,O,O,D,S,S,L,O,O,O,O,O,O,O,O,O,O,O,O,L,S,S,D,O,O,O,O,O,B,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
[_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,B,O,O,O,D,S,S,L,L,O,O,O,O,O,O,O,O,L,L,S,S,D,O,O,O,O,O,B,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
// Row 54-55: tapered jaw
[_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,B,O,O,O,D,D,S,S,L,L,L,O,O,L,L,L,S,S,D,D,O,O,O,O,O,B,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
[_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,B,O,O,O,D,D,S,S,S,L,L,L,L,S,S,S,D,D,O,O,O,O,O,B,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
// Row 56-57: narrow jaw
[_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,B,O,O,O,D,D,G,S,S,S,S,S,S,G,D,D,O,O,O,O,O,B,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
[_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,B,O,O,O,O,D,D,G,D,D,G,D,D,O,O,O,O,O,O,B,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
// Row 58-59: chin tip
[_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,B,B,O,O,O,O,D,D,D,D,O,O,O,O,O,O,B,B,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
[_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,B,B,O,O,O,O,O,O,O,O,O,O,B,B,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
// Row 60-61: bottom
[_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,B,B,O,O,O,O,O,O,B,B,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
[_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,B,B,B,B,B,B,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
// Row 62-63: very bottom
[_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,B,B,B,B,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
[_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,B,B,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
]

// ─── Problem Section Pixel Art Icons ───────────────────────

// Bank / Traditional Finance — cyan themed
const cy = '#00FFF0'
const cd = '#00B8AA'

export const BANK_PIXEL_MAP: (string | null)[][] = [
    [_,_,_,_,_,_,_,cy,cy,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,cy,cy,cy,cy,_,_,_,_,_,_],
    [_,_,_,_,_,cy,cy,cy,cy,cy,cy,_,_,_,_,_],
    [_,_,_,_,cy,cy,cy,cy,cy,cy,cy,cy,_,_,_,_],
    [_,_,_,cy,cy,cy,cy,cy,cy,cy,cy,cy,cy,_,_,_],
    [_,_,B,cd,cd,cd,cd,cd,cd,cd,cd,cd,cd,B,_,_],
    [_,_,B,cy,cy,cy,cy,cy,cy,cy,cy,cy,cy,B,_,_],
    [_,_,B,cy,_,cy,_,cy,cy,_,cy,_,cy,B,_,_],
    [_,_,B,cy,_,cy,_,cy,cy,_,cy,_,cy,B,_,_],
    [_,_,B,cy,_,cy,_,cy,cy,_,cy,_,cy,B,_,_],
    [_,_,B,cy,_,cy,_,cy,cy,_,cy,_,cy,B,_,_],
    [_,_,B,cy,_,cy,_,cy,cy,_,cy,_,cy,B,_,_],
    [_,_,B,cd,cd,cd,cd,cd,cd,cd,cd,cd,cd,B,_,_],
    [_,_,B,B,B,B,B,B,B,B,B,B,B,B,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
]

// Hourglass / DeFi Today — orange themed
const am = '#FF5C00'
const ao = '#CC4A00'

export const HOURGLASS_PIXEL_MAP: (string | null)[][] = [
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,B,B,B,B,B,B,B,B,B,B,_,_,_],
    [_,_,_,_,am,am,am,am,am,am,am,am,_,_,_,_],
    [_,_,_,_,_,am,am,am,am,am,am,_,_,_,_,_],
    [_,_,_,_,_,_,am,am,am,am,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,ao,ao,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,am,am,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,am,am,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,ao,_,_,ao,_,_,_,_,_,_],
    [_,_,_,_,_,ao,_,_,_,_,ao,_,_,_,_,_],
    [_,_,_,_,ao,_,_,_,_,_,_,ao,_,_,_,_],
    [_,_,_,_,am,am,_,_,_,_,am,am,_,_,_,_],
    [_,_,_,_,am,am,am,am,am,am,am,am,_,_,_,_],
    [_,_,_,B,B,B,B,B,B,B,B,B,B,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
]

// Broken Shield / No Enforcement — ruby red themed
const rd = '#E0115F'
const rk = '#B80D4C'

export const SHIELD_PIXEL_MAP: (string | null)[][] = [
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,B,B,B,B,B,B,B,B,B,B,_,_,_],
    [_,_,B,rd,rd,rd,rd,rd,rd,rd,rd,rd,rd,B,_,_],
    [_,B,rd,rd,rd,rd,_,_,_,rd,rd,rd,rd,rd,B,_],
    [_,B,rd,rd,rd,_,_,_,_,_,rd,rd,rd,rd,B,_],
    [_,B,rd,rd,rd,rd,_,_,_,rd,rd,rd,rd,rd,B,_],
    [_,B,rd,rd,rd,rd,rk,_,rk,rd,rd,rd,rd,rd,B,_],
    [_,_,B,rd,rd,_,_,_,_,_,rd,rd,rd,B,_,_],
    [_,_,B,rd,rd,rd,_,_,_,rd,rd,rd,rd,B,_,_],
    [_,_,_,B,rd,rd,_,_,_,rd,rd,rd,B,_,_,_],
    [_,_,_,B,rd,rd,rk,_,rk,rd,rd,rd,B,_,_,_],
    [_,_,_,_,B,rd,rd,rd,rd,rd,rd,B,_,_,_,_],
    [_,_,_,_,_,B,rd,rd,rd,rd,B,_,_,_,_,_],
    [_,_,_,_,_,_,B,B,B,B,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
]
