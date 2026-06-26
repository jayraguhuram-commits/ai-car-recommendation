import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import './DynamicHeadlight.css';

export default function DynamicHeadlight() {
  const [theme, setTheme] = useState(
    document.documentElement.getAttribute('data-theme') || 'dark'
  );

  // Track the mouse to update CSS variables for offset
  useEffect(() => {
    const handleMouseMove = (e) => {
      // Normalize mouse coordinates to a -1 to 1 range
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = (e.clientY / window.innerHeight) * 2 - 1;
      
      // Update CSS variables directly on the element or root
      document.documentElement.style.setProperty('--mouse-x', x);
      document.documentElement.style.setProperty('--mouse-y', y);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Listen for theme changes via a MutationObserver on html[data-theme]
  // since the theme is changed outside of this component (in NavBar).
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          const newTheme = document.documentElement.getAttribute('data-theme');
          setTheme(newTheme || 'dark');
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  const isDark = theme === 'dark';

  // Animation variants using Spring physics (Framer Motion)
  const headlightVariants = {
    dark: {
      opacity: 1,
      scale: 1,
      filter: 'drop-shadow(0 0 20px rgba(255, 255, 255, 0.8)) drop-shadow(0 0 40px rgba(0, 150, 255, 0.4))',
      transition: {
        type: 'spring',
        stiffness: 100,
        damping: 20,
        mass: 1,
      },
    },
    light: {
      opacity: 0.3,
      scale: 0.95,
      filter: 'drop-shadow(0 0 0px rgba(255, 255, 255, 0)) drop-shadow(0 0 0px rgba(0, 0, 0, 0))',
      transition: {
        type: 'spring',
        stiffness: 80,
        damping: 15,
        mass: 1,
      },
    },
  };

  const pathVariants = {
    dark: {
      stroke: '#ffffff',
      fill: '#ffffff',
      strokeWidth: 2,
    },
    light: {
      stroke: 'var(--color-text-muted)',
      fill: 'transparent',
      strokeWidth: 1.5,
    },
  };

  return (
    <div className="headlight-container" aria-hidden="true">
      <motion.div
        className="headlight-eyes"
        initial={isDark ? 'dark' : 'light'}
        animate={isDark ? 'dark' : 'light'}
        variants={headlightVariants}
      >
        <svg
          viewBox="0 0 800 200"
          className="headlight-svg"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Left Eye (Y-Shape) */}
          <motion.path
            d="M200 40 L280 80 L300 120 L270 110 L250 160 L230 110 L150 90 Z"
            variants={pathVariants}
            className="led-path left-led"
          />
          {/* Right Eye (Y-Shape, mirrored) */}
          <motion.path
            d="M600 40 L520 80 L500 120 L530 110 L550 160 L570 110 L650 90 Z"
            variants={pathVariants}
            className="led-path right-led"
          />
        </svg>
      </motion.div>
    </div>
  );
}
