import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
  glow?: 'blue' | 'gold' | 'none';
}

export function Card({ children, className, glow = 'none', ...props }: CardProps) {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={cn(
        "bg-glass rounded-2xl p-4 transition-all duration-300",
        "shadow-[0_15px_35px_-5px_rgba(15,240,252,0.15),0_5px_15px_rgba(0,0,0,0.5)]",
        "hover:shadow-[0_25px_45px_-5px_rgba(15,240,252,0.25),0_10px_20px_rgba(0,0,0,0.6)]",
        glow === 'blue' && "border border-[var(--color-electricBlue)]/30",
        glow === 'gold' && "border border-[var(--color-royalGold)]/50 shadow-[0_0_20px_rgba(255,215,0,0.2)] hover:shadow-[0_0_30px_rgba(255,215,0,0.4)]",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}
