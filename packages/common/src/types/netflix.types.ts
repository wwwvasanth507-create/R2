export enum ContentRating {
  G = 'G',
  PG = 'PG',
  PG13 = 'PG-13',
  R = 'R',
  NC17 = 'NC-17',
  TV_MA = 'TV-MA'
}

export enum MediaCategoryType {
  MOVIE = 'MOVIE',
  SERIES = 'SERIES'
}

export interface IGenre {
  id: string;
  name: string;
  slug: string;
}

export interface IMovie {
  id: string;
  title: string;
  description: string;
  releaseYear: number;
  durationMinutes: number;
  rating: ContentRating;
  backdropUrl: string;
  posterUrl: string;
  trailerUrl?: string;
  masterPlaylistUrl: string; // HLS Master Playlist (.m3u8)
  audioTracks: { language: string; label: string; url: string }[];
  subtitles: { language: string; label: string; url: string }[];
  genres: IGenre[];
  isFeatured: boolean;
  isTrending: boolean;
  viewsCount: number;
  createdAt: Date;
}

export interface ISeries {
  id: string;
  title: string;
  description: string;
  releaseYear: number;
  rating: ContentRating;
  backdropUrl: string;
  posterUrl: string;
  trailerUrl?: string;
  genres: IGenre[];
  seasonsCount: number;
  isFeatured: boolean;
  isTrending: boolean;
  createdAt: Date;
  seasons?: ISeason[];
}

export interface ISeason {
  id: string;
  seriesId: string;
  seasonNumber: number;
  title: string;
  overview: string;
  posterUrl?: string;
  episodes?: IEpisode[];
}

export interface IEpisode {
  id: string;
  seasonId: string;
  episodeNumber: number;
  title: string;
  overview: string;
  durationMinutes: number;
  stillUrl: string;
  masterPlaylistUrl: string;
  subtitles: { language: string; label: string; url: string }[];
  audioTracks: { language: string; label: string; url: string }[];
}

export interface IWatchHistory {
  id: string;
  userId: string;
  mediaType: MediaCategoryType;
  movieId?: string;
  episodeId?: string;
  progressSeconds: number;
  totalDurationSeconds: number;
  isCompleted: boolean;
  lastWatchedAt: Date;
}

export interface IWatchlist {
  id: string;
  userId: string;
  mediaType: MediaCategoryType;
  movieId?: string;
  seriesId?: string;
  addedAt: Date;
}
