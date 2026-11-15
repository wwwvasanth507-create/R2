import {
  IMovie,
  ISeries,
  IGenre,
  IWatchHistory,
  IWatchlist,
  MediaCategoryType
} from '@platform/common';
import { DatabaseService } from '../database/db.service';

export class NetflixService {
  constructor(private readonly db: DatabaseService) {}

  public getGenres(): IGenre[] {
    return Array.from(this.db.genres.values());
  }

  public getFeaturedContent(): { movies: IMovie[]; series: ISeries[] } {
    const movies = Array.from(this.db.movies.values()).filter((m) => m.isFeatured);
    const series = Array.from(this.db.series.values()).filter((s) => s.isFeatured);
    return { movies, series };
  }

  public getMovies(genreSlug?: string, search?: string): IMovie[] {
    let result = Array.from(this.db.movies.values());

    if (genreSlug) {
      result = result.filter((m) => m.genres.some((g) => g.slug === genreSlug));
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) => m.title.toLowerCase().includes(q) || m.description.toLowerCase().includes(q)
      );
    }

    return result;
  }

  public getMovieById(id: string): IMovie | undefined {
    const movie = this.db.movies.get(id);
    if (movie) {
      movie.viewsCount = (movie.viewsCount || 0) + 1;
    }
    return movie;
  }

  public getSeries(search?: string): ISeries[] {
    let result = Array.from(this.db.series.values());
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) => s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
      );
    }
    return result;
  }

  public getSeriesById(id: string): (ISeries & { seasons: any[] }) | undefined {
    const series = this.db.series.get(id);
    if (!series) return undefined;

    const seasons = Array.from(this.db.seasons.values())
      .filter((s) => s.seriesId === id)
      .map((season) => ({
        ...season,
        episodes: Array.from(this.db.episodes.values()).filter((e) => e.seasonId === season.id)
      }));

    return { ...series, seasons };
  }

  public getWatchHistory(userId: string): IWatchHistory[] {
    return Array.from(this.db.watchHistory.values())
      .filter((w) => w.userId === userId)
      .sort((a, b) => b.lastWatchedAt.getTime() - a.lastWatchedAt.getTime());
  }

  public updateWatchProgress(
    userId: string,
    mediaType: MediaCategoryType,
    mediaId: string,
    progressSeconds: number,
    totalDurationSeconds: number
  ): IWatchHistory {
    const historyId = `wh-${userId}-${mediaId}`;
    const isCompleted = progressSeconds >= totalDurationSeconds * 0.95;

    const entry: IWatchHistory = {
      id: historyId,
      userId,
      mediaType,
      movieId: mediaType === MediaCategoryType.MOVIE ? mediaId : undefined,
      episodeId: mediaType === MediaCategoryType.SERIES ? mediaId : undefined,
      progressSeconds,
      totalDurationSeconds,
      isCompleted,
      lastWatchedAt: new Date()
    };

    this.db.watchHistory.set(historyId, entry);
    return entry;
  }

  public getWatchlist(userId: string) {
    return Array.from(this.db.watchlists.values()).filter((w) => w.userId === userId);
  }

  public addToWatchlist(userId: string, mediaType: MediaCategoryType, mediaId: string) {
    const id = `wl-${userId}-${mediaId}`;
    const entry: IWatchlist = {
      id,
      userId,
      mediaType,
      movieId: mediaType === MediaCategoryType.MOVIE ? mediaId : undefined,
      seriesId: mediaType === MediaCategoryType.SERIES ? mediaId : undefined,
      addedAt: new Date()
    };
    this.db.watchlists.set(id, entry);
    return entry;
  }
}
