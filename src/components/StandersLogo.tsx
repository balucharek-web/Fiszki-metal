import React from 'react';

interface StandersLogoProps {
  className?: string;
  brandText?: string;
  showText?: boolean;
}

export const StandersLogo: React.FC<StandersLogoProps> = ({
  className = '',
  brandText = 'STANDERS',
  showText = true,
}) => {
  return (
    <div className={`flex flex-col items-center justify-center select-none ${className}`}>
      {/* Standers Iconic Overlapping Link / Loop Mark */}
      <svg
        viewBox="0 0 140 76"
        className="w-[32mm] max-h-[17mm] object-contain"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Upper rounded loop */}
        <path
          d="M 50 4 
             L 105 4 
             A 18 18 0 0 1 123 22 
             A 18 18 0 0 1 105 40 
             L 50 40 
             A 18 18 0 0 1 32 22 
             A 18 18 0 0 1 50 4 Z"
          fill="#000000"
        />
        {/* Upper inner cutout */}
        <path
          d="M 50 16 
             L 105 16 
             A 6 6 0 0 1 111 22 
             A 6 6 0 0 1 105 28 
             L 50 28 
             A 6 6 0 0 1 44 22 
             A 6 6 0 0 1 50 16 Z"
          fill="#ffffff"
        />

        {/* Lower shifted rounded loop */}
        <path
          d="M 35 34 
             L 90 34 
             A 18 18 0 0 1 108 52 
             A 18 18 0 0 1 90 70 
             L 35 70 
             A 18 18 0 0 1 17 52 
             A 18 18 0 0 1 35 34 Z"
          fill="#000000"
        />
        {/* Lower inner cutout */}
        <path
          d="M 35 46 
             L 90 46 
             A 6 6 0 0 1 96 52 
             A 6 6 0 0 1 90 58 
             L 35 58 
             A 6 6 0 0 1 29 52 
             A 6 6 0 0 1 35 46 Z"
          fill="#ffffff"
        />
      </svg>

      {/* Brand Text */}
      {showText && (
        <span
          className="text-black font-extrabold tracking-wider leading-none mt-[2.2mm]"
          style={{
            fontFamily: "'Leroy Merlin Sans', system-ui, sans-serif",
            fontSize: '3.6mm',
            letterSpacing: '0.08em',
          }}
        >
          {brandText}
        </span>
      )}
    </div>
  );
};
