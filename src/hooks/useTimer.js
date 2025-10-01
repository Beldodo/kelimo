import { useEffect, useRef, useState } from 'react';

export function useTimer() {
  const [timer, setTimer] = useState(0);
  const intervalRef = useRef(null);
  const onFinishRef = useRef(null);

  const startTimer = (duration, onFinish) => {
    clearInterval(intervalRef.current);
    setTimer(Math.floor(duration / 1000));
    onFinishRef.current = onFinish;

    intervalRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          if (onFinishRef.current) onFinishRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopTimer = () => {
    clearInterval(intervalRef.current);
    setTimer(0);
    onFinishRef.current = null;
  };

  useEffect(() => {
    return () => clearInterval(intervalRef.current);
  }, []);

  return { timer, startTimer, stopTimer };
}
