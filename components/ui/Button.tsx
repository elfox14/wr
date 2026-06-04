import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ButtonProps extends HTMLMotionProps<"button"> {
  children: React.ReactNode;
  variant?: 'primary' | 'gold' | 'outline';
  className?: string;
}

export function Button({ children, variant = 'primary', className, ...props }: ButtonProps) {
  const baseClasses = "px-6 py-3 rounded-full font-bold tracking-wide transition-all duration-300 flex items-center justify-center gap-2";
  
  const variants = {
    primary: "bg-[#0FF0FC] text-[#121212] shadow-[0_0_15px_rgba(15,240,252,0.4)] hover:shadow-[0_0_25px_rgba(15,240,252,0.6)]",
    gold: "bg-[#FFD700] text-[#121212] shadow-[0_0_15px_rgba(255,215,0,0.4)] hover:shadow-[0_0_25px_rgba(255,215,0,0.6)]",
    outline: "border border-[#0FF0FC] text-[#0FF0FC] hover:bg-[#0FF0FC]/10 shadow-[0_0_10px_rgba(15,240,252,0.2)]"
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={cn(baseClasses, variants[variant], className)}
      {...props}
    >
      {children}
    </motion.button>
  );
}
