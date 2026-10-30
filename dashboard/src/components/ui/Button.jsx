import { cn } from "./utils";

export const Button = ({ className, variant = "primary", children, ...props }) => {
  const variants = {
    primary:
      "bg-blue-600 text-white hover:bg-blue-700 shadow-sm focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
    secondary:
      "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 shadow-sm focus:ring-2 focus:ring-gray-300 focus:ring-offset-2",
    outline:
      "border border-gray-300 text-gray-700 hover:bg-gray-50 shadow-sm focus:ring-2 focus:ring-gray-300 focus:ring-offset-2",
  };

  return (
    <button
      className={cn("btn-base rounded-xl px-4 py-2.5 text-sm font-medium transition-colors", variants[variant], className)}
      {...props}
    >
      {children}
    </button>
  );
};

export const btnBase =
  "inline-flex items-center justify-center gap-2 transition-colors focus:outline-none";
