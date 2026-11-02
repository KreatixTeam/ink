import type { Transition } from 'motion/react'

export const spring: Transition = { type: 'spring', stiffness: 520, damping: 42, mass: 0.9 }
export const springSoft: Transition = { type: 'spring', stiffness: 340, damping: 36 }
export const fade: Transition = { duration: 0.16, ease: [0.2, 0, 0, 1] }
