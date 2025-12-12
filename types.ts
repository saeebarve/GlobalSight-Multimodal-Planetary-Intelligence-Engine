
export interface AnalysisState {
  isLoading: boolean;
  result: AnalysisResult | null;
  error: string | null;
}

export interface AnalysisResult {
  text: string;
  groundingMetadata?: {
    groundingChunks: Array<{
      web?: {
        uri: string;
        title: string;
      };
    }>;
  };
}

export interface FileData {
  file?: File; // Optional now as we might just have audio
  previewUrl: string;
  base64: string;
  mimeType: string;
}

export interface AudioData {
  blob: Blob;
  previewUrl: string;
  base64: string;
  mimeType: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

// Helper type for parsed sections of the AI response
export interface ParsedSection {
  title: string;
  icon: string;
  content: string;
  type: 'text' | 'code' | 'list' | 'table' | 'impact';
  theme: string;
}
