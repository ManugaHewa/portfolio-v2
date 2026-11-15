/**
 * Motion primitives, all prerender-safe: server output equals the first
 * client render, with the finished text in the HTML. Import Motion from ./m.
 */
export * from "./hooks";
export * from "./ease";
export { morphId } from "./morph";
export { SectionHead } from "./SectionHead";
export { SplitTitle } from "./SplitTitle";
export { HeroName } from "./HeroName";
export { Scramble } from "./Scramble";
export { TextLoop } from "./TextLoop";
export { Odometer } from "./Odometer";
export { Magnetic } from "./Magnetic";
export { Marquee } from "./Marquee";
export { ScrollProgress } from "./ScrollProgress";
export { IndexRail } from "./IndexRail";
export { PauseMotionToggle } from "./PauseMotionToggle";
