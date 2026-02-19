/**
 * Speech Synthesis Utility
 * Provides text-to-speech functionality for accessibility
 */

export const speakText = (text: string, language: string = 'en-US') => {
  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  (utterance as any).language = language;
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.volume = 1;

  window.speechSynthesis.speak(utterance);
};

export const stopSpeaking = () => {
  window.speechSynthesis.cancel();
};

export const isSpeechSynthesisSupported = (): boolean => {
  return 'speechSynthesis' in window;
};

export const isSpeaking = (): boolean => {
  return window.speechSynthesis.speaking;
};

/**
 * Speech Recognition Utility
 * Provides speech-to-text functionality for voice commands
 */

const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export const isSpeechRecognitionSupported = (): boolean => {
  return !!SpeechRecognition;
};

interface SpeechRecognitionOptions {
  language?: string;
  onResult: (transcript: string) => void;
  onError?: (error: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

export const startSpeechRecognition = (options: SpeechRecognitionOptions) => {
  if (!isSpeechRecognitionSupported()) {
    if (options.onError) {
      options.onError('Speech Recognition not supported in this browser');
    }
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.language = options.language || 'en-US';
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    if (options.onStart) options.onStart();
  };

  recognition.onresult = (event: any) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        transcript += event.results[i][0].transcript;
      }
    }
    if (transcript.trim()) {
      options.onResult(transcript.trim());
    }
  };

  recognition.onerror = (event: any) => {
    if (options.onError) {
      options.onError(event.error);
    }
  };

  recognition.onend = () => {
    if (options.onEnd) options.onEnd();
  };

  recognition.start();
  return recognition;
};

export const stopSpeechRecognition = (recognition: any) => {
  if (recognition) {
    recognition.stop();
  }
};
