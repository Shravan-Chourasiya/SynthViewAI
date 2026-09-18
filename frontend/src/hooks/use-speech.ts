import { useState, useEffect } from 'react';

export function useSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [utterance, setUtterance] = useState<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    // Clean up any ongoing speech when component unmounts
    return () => {
      if (window.speechSynthesis && utterance) {
        window.speechSynthesis.cancel();
      }
    };
  }, [utterance]);

  const speak = (text: string) => {
    if (!window.speechSynthesis) {
      console.warn('Speech synthesis not supported in this browser');
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const newUtterance = new SpeechSynthesisUtterance(text);
    newUtterance.lang = 'en-US';
    
    newUtterance.onstart = () => {
      setIsSpeaking(true);
    };
    
    newUtterance.onend = () => {
      setIsSpeaking(false);
    };
    
    newUtterance.onerror = () => {
      setIsSpeaking(false);
    };

    setUtterance(newUtterance);
    window.speechSynthesis.speak(newUtterance);
  };

  const stop = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  return {
    speak,
    stop,
    isSpeaking
  };
}