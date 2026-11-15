/**
 * The only import point for framer-motion. Use `m.*`, never `motion.*`: the
 * root loads features once via <LazyMotion features={domMax} strict>, which
 * throws on a full `motion` component. domMax for the dialog's layoutId morph.
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
