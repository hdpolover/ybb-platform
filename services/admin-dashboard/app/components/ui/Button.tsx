"use client";

import React from "react";

const VARIANTS = {
  primary: "bg-emerald-500 text-white border border-transparent hover:bg-emerald-600 shadow-sm focus:ring-emerald-500",
  secondary: "bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-50 shadow-sm focus:ring-zinc-200",
  blue: "bg-blue-600 text-white border border-transparent hover:bg-blue-700 shadow-sm focus:ring-blue-500",
  danger: "bg-red-600 text-white border border-transparent hover:bg-red-700 shadow-sm focus:ring-red-500",
  ghost: "bg-transparent text-zinc-600 border border-transparent hover:bg-zinc-100 hover:text-zinc-900",
  outline: "bg-transparent text-zinc-700 border border-zinc-300 hover:bg-zinc-50",
};

const SIZES = {
  xs: "px-2 py-1 text-[10px]",        
  sm: "px-3 py-1.5 text-xs",          
  md: "px-4 py-2 text-sm",            
  lg: "px-6 py-3 text-base",          
  icon: "p-2",   
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  isLoading?: boolean;
  fullWidth?: boolean;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;  
}

export function Button({
  children,
  className = "",
  variant = "primary",
  size = "md",
  isLoading = false,
  fullWidth = false,
  startIcon,
  endIcon,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  
  const baseStyles = 
    "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed";

  const finalClass = `
    ${baseStyles}
    ${VARIANTS[variant]}
    ${SIZES[size]}
    ${fullWidth ? "w-full" : ""}
    ${className}
  `;

  return (
    <button
      type={type}
      className={finalClass}
      disabled={isLoading || disabled}
      {...props}
    >
      {isLoading && (
        <svg
          className="animate-spin h-4 w-4 text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}

      {!isLoading && startIcon && <span>{startIcon}</span>}

      <span>{children}</span>

      {!isLoading && endIcon && <span>{endIcon}</span>}
    </button>
  );
}