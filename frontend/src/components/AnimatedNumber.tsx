import { useEffect, useRef, useState } from 'react';

interface Props {
  value: number;
  format?: (n: number) => string;
  className?: string;
  duration?: number;
}

export default function AnimatedNumber({ value, format, className = '', duration = 600 }: Props) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const rafRef = useRef<number>();

  useEffect(() => {
    const start = prevRef.current;
    const diff = value - start;
    if (Math.abs(diff) < 0.001) {
      setDisplay(value);
      prevRef.current = value;
      return;
    }

    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplay(start + diff * eased);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        prevRef.current = value;
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value, duration]);

  const formatted = format ? format(display) : display.toFixed(2);

  return <span className={`font-mono tabular-nums ${className}`}>{formatted}</span>;
}
