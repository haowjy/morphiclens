import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind classes conditionally and safely.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generates a unique ID.
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

/**
 * Formats a timestamp into a readable time string.
 */
export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Generates a creative random name for session artifacts.
 * Format: artifact_[adjective]_[noun]_[hash]
 */
export function generateArtifactName(): string {
  const adjectives = [
      'visual', 'spectral', 'processed', 'quantified', 'filtered', 'binary', 
      'segmented', 'enhanced', 'normalized', 'clustered', 'projected', 'merged'
  ];
  const nouns = [
      'plot', 'histogram', 'mask', 'heatmap', 'scatter', 'projection', 
      'distribution', 'morphology', 'signal', 'layer', 'preview', 'composite'
  ];
  
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const hash = Math.random().toString(36).substring(2, 6);
  
  return `artifact_${adj}_${noun}_${hash}`;
}