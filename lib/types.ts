export interface QdrantHit {
  id: number;
  vector?: number[];
  payload?: {
    topic?: string;
    content?: string;
    [key: string]: unknown;
  };
  score?: number;
}


export interface TavilyResult {
  title: string;
  snippet: string;
}

// 사연 기반 노래 제작 관련 타입들
export interface Story {
  id: string;
  content: string;
  userId: string;
  createdAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface Lyrics {
  id: string;
  storyId: string;
  content: string;
  title: string;
  createdAt: Date;
  status: 'pending' | 'completed' | 'failed';
}

export interface Song {
  id: string;
  lyricsId: string;
  storyId: string;
  audioUrl: string;
  duration: number;
  createdAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface Video {
  id: string;
  songId: string;
  storyId: string;
  videoUrl: string;
  thumbnailUrl: string;
  duration: number;
  createdAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface ContentItem {
  id: string;
  story: Story;
  lyrics?: Lyrics;
  song?: Song;
  video?: Video;
  createdAt: Date;
}