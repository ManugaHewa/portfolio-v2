/**
 * Motion primitives, all prerender-safe: server output equals the first
 * client render, with the finished text in the HTML. Import Motion from ./m.
 */
export * from "./hooks";
export { morphId } from "./morph";
export { SectionHead } from "./SectionHead";
export type { SectionHeadProps } from "./SectionHead";
export { SplitTitle } from "./SplitTitle";
export type { SplitTitleProps, SplitTitleTag } from "./SplitTitle";
export { HeroName } from "./HeroName";
export type { HeroNameProps } from "./HeroName";
export { Scramble } from "./Scramble";
export type { ScrambleProps, ScrambleTrigger } from "./Scramble";
export { TextLoop } from "./TextLoop";
export type { TextLoopProps } from "./TextLoop";
export { Odometer } from "./Odometer";
export type { OdometerProps } from "./Odometer";
export { Reveal } from "./Reveal";
export type { RevealProps, RevealTag } from "./Reveal";
export { Magnetic } from "./Magnetic";
export type { MagneticProps } from "./Magnetic";
export { Marquee } from "./Marquee";
export type { MarqueeProps } from "./Marquee";
export { ScrollProgress } from "./ScrollProgress";
export { IndexRail } from "./IndexRail";
export type { IndexRailProps, RailSection } from "./IndexRail";
export { PauseMotionToggle } from "./PauseMotionToggle";
