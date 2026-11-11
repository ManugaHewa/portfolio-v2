/**
 * The one door to Motion (the framer-motion package). Components import from
 * here and use `m.*`, never `motion.*`: the app root loads the features once
 * through <LazyMotion features={domMax} strict>, and strict mode throws if a
 * full `motion` component slips in and drags every feature into the bundle
 * a second time. domMax rather than domAnimation because the case-study
 * dialog morphs from its card with layoutId.
 */
export {
  m,
  LazyMotion,
  domMax,
  AnimatePresence,
  LayoutGroup,
  useScroll,
  useTransform,
  useSpring,
  useMotionValue,
  useMotionTemplate,
  useInView,
  animate,
} from "framer-motion";
export type { MotionValue, Variants, Transition } from "framer-motion";
