/**
 * Hook for managing scroll behavior in chat view
 */

import { useState, useCallback, useRef, useEffect } from 'react';

export interface UseScrollManagementReturn {
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  mainRef: React.RefObject<HTMLElement | null>;
  showScrollToBottom: boolean;
  scrollToBottom: (smooth?: boolean) => void;
  isNearBottom: () => boolean;
}

export function useScrollManagement(): UseScrollManagementReturn {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  // Helper to check if scrolled near bottom
  const isNearBottom = useCallback(() => {
    const main = mainRef.current;
    if (!main) return true;
    const threshold = 100;
    return main.scrollHeight - main.scrollTop - main.clientHeight < threshold;
  }, []);

  // Scroll to bottom helper
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    setShowScrollToBottom(false);
  }, []);

  // Detect scrolling to show/hide scroll to bottom button
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;

    const handleScroll = () => {
      setShowScrollToBottom(!isNearBottom());
    };

    main.addEventListener('scroll', handleScroll);
    return () => main.removeEventListener('scroll', handleScroll);
  }, [isNearBottom]);

  return {
    messagesEndRef,
    mainRef,
    showScrollToBottom,
    scrollToBottom,
    isNearBottom,
  };
}
