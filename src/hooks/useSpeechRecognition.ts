/**
 * Web Speech API hook for speech-to-text
 * Supports three modes: auto (with delay), PTT (push-to-talk), and manual
 */

import { useState, useEffect, useRef, useCallback } from "react";

// Extend Window interface for Web Speech API
interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
  onstart: () => void;
  onspeechstart: () => void;
  onspeechend: () => void;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition;
    webkitSpeechRecognition: new () => ISpeechRecognition;
  }
}

export type RecognitionMode = "auto" | "ptt" | "manual";

export interface SpeechRecognitionCallbacks {
  onResult: (text: string) => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
}

export function useSpeechRecognition(
  callbacks: SpeechRecognitionCallbacks | ((text: string) => void),
  mode: RecognitionMode = "manual",
  autoSendDelay = 1500 // Delay in ms before auto-sending in "auto" mode
) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const autoSendTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const accumulatedTranscriptRef = useRef<string>(""); // TODO: Accumulate text during PTT session

  // Normalize callbacks - support both old function signature and new object signature
  const onResult = typeof callbacks === "function" ? callbacks : callbacks.onResult;
  const onSpeechStart = typeof callbacks === "object" ? callbacks.onSpeechStart : undefined;
  const onSpeechEnd = typeof callbacks === "object" ? callbacks.onSpeechEnd : undefined;

  // TODO: Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      console.warn("[Speech] Web Speech API not supported");
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i]![0]!.transcript;
        if (event.results[i]!.isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interimTranscript += transcript;
        }
      }

      // TODO: Accumulate final results during continuous session (PTT, Auto, Manual)
      if (finalTranscript.trim()) {
        accumulatedTranscriptRef.current += finalTranscript;
      }

      // Update transcript display (accumulated + current interim)
      const displayTranscript = (accumulatedTranscriptRef.current + interimTranscript).trim();
      setTranscript(displayTranscript);

      // TODO: Auto mode - send after delay of silence (smart debouncing handled by onspeechend)
      if (mode === "auto" && finalTranscript.trim()) {
        // Clear existing timeout
        if (autoSendTimeoutRef.current) {
          clearTimeout(autoSendTimeoutRef.current);
        }

        // Set new timeout to send (will be cleared if user continues speaking)
        autoSendTimeoutRef.current = setTimeout(() => {
          if (accumulatedTranscriptRef.current.trim()) {
            onResult(accumulatedTranscriptRef.current.trim());
            setTranscript("");
            accumulatedTranscriptRef.current = "";
          }
        }, autoSendDelay);
      }
    };

    recognition.onerror = (event) => {
      console.error("[Speech] Error:", event.error);
      setIsListening(false);
    };

    recognition.onstart = () => {
      setIsListening(true);
    };

    // onspeechstart - User started speaking (smart debouncing: pause timeout)
    recognition.onspeechstart = () => {
      setIsSpeaking(true);
      onSpeechStart?.();

      // Clear auto-send timeout when user starts speaking again
      if (mode === "auto" && autoSendTimeoutRef.current) {
        clearTimeout(autoSendTimeoutRef.current);
        autoSendTimeoutRef.current = null;
      }
    };

    // onspeechend - User stopped speaking (smart debouncing: resume timeout)
    recognition.onspeechend = () => {
      setIsSpeaking(false);
      onSpeechEnd?.();
    };

    recognition.onend = () => {
      setIsListening(false);
      setIsSpeaking(false);

      // TODO: In continuous mode (auto), restart automatically
      if (mode === "auto") {
        recognition.start();
        setIsListening(true);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      if (autoSendTimeoutRef.current) {
        clearTimeout(autoSendTimeoutRef.current);
      }
    };
  }, [mode, autoSendDelay, onResult]);

  // TODO: Start listening
  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListening) return;

    try {
      recognitionRef.current.start();
      setIsListening(true);
      setTranscript("");
      accumulatedTranscriptRef.current = ""; // Clear accumulated text for new session
    } catch (error) {
      console.error("[Speech] Failed to start:", error);
    }
  }, [isListening]);

  // TODO: Stop listening
  const stopListening = useCallback(() => {
    if (!recognitionRef.current || !isListening) return;

    try {
      // Capture current transcript (includes interim results) before stopping
      const currentTranscript = (accumulatedTranscriptRef.current + " " + transcript).trim();

      recognitionRef.current.stop();
      setIsListening(false);

      // TODO: PTT mode - send full transcript (including interim results) when releasing button
      if (mode === "ptt" && currentTranscript) {
        onResult(currentTranscript);
        setTranscript("");
        accumulatedTranscriptRef.current = "";
      }
    } catch (error) {
      console.error("[Speech] Failed to stop:", error);
    }
  }, [isListening, mode, onResult, transcript]);

  // TODO: Manual send
  const sendTranscript = useCallback(() => {
    const textToSend = accumulatedTranscriptRef.current.trim();
    if (textToSend) {
      onResult(textToSend);
      setTranscript("");
      accumulatedTranscriptRef.current = "";
    }
  }, [onResult]);

  // TODO: Auto mode - start on mount
  useEffect(() => {
    if (mode === "auto" && isSupported) {
      startListening();
    }

    return () => {
      if (mode === "auto") {
        stopListening();
      }
    };
  }, [mode, isSupported]);

  return {
    isListening,
    isSpeaking,
    transcript,
    isSupported,
    startListening,
    stopListening,
    sendTranscript,
    setTranscript,
  };
}
