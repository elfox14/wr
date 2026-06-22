import React from 'react';

function cleanProps(props: Record<string, any>) {
  const {
    animate,
    initial,
    exit,
    transition,
    variants,
    whileHover,
    whileTap,
    whileInView,
    viewport,
    layout,
    layoutId,
    drag,
    dragConstraints,
    dragElastic,
    ...rest
  } = props || {};
  return rest;
}

function createMotionElement(tag: string) {
  return React.forwardRef<any, any>(function MotionStub(props, ref) {
    return React.createElement(tag, { ...cleanProps(props), ref }, props?.children);
  });
}

export const motion: any = new Proxy({}, {
  get(_target, prop) {
    return createMotionElement(String(prop));
  },
});

export const m = motion;

export function AnimatePresence({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

export function LazyMotion({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

export function domAnimation() {
  return null;
}

export function useAnimation() {
  return { start: async () => undefined, stop: () => undefined, set: () => undefined };
}

export function useInView() {
  return true;
}

export function useReducedMotion() {
  return true;
}

export function useScroll() {
  return { scrollYProgress: { get: () => 0, on: () => () => undefined } };
}

export function useTransform() {
  return 0;
}

export function useSpring(value: any) {
  return value;
}

export type HTMLMotionProps<T extends React.ElementType = 'div'> = React.ComponentPropsWithoutRef<T> & Record<string, any>;
