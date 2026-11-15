import {
  IUser,
  UserRole,
  UserStatus,
  IStorageAccount,
  StorageAccountStatus,
  IStorageBucket,
  BucketHealthStatus,
  IStorageReservation,
  IStorageAlert,
  AlertSeverity,
  IFileManifest,
  IFileChunkManifest,
  FileUploadStatus,
  ChunkUploadStatus,
  VideoProcessingStatus,
  IMovie,
  ISeries,
  ISeason,
  IEpisode,
  IGenre,
  IWatchHistory,
  IWatchlist,
  ContentRating,
  IChannel,
  IVideo,
  VideoVisibility,
  IVideoComment,
  ISubscription,
  IPost,
  PostMediaType,
  IStory,
  IFollow,
  IDirectMessage,
  INotification,
  DEFAULT_LOGICAL_QUOTA_BYTES
} from '@platform/common';

export class DatabaseService {
  // Data stores
  public users: Map<string, IUser & { passwordHash: string }> = new Map();
  public storageAccounts: Map<string, IStorageAccount & { secretAccessKey: string }> = new Map();
  public storageBuckets: Map<string, IStorageBucket> = new Map();
  public storageReservations: Map<string, IStorageReservation> = new Map();
  public storageAlerts: Map<string, IStorageAlert> = new Map();
  public files: Map<string, IFileManifest> = new Map();
  public fileChunks: Map<string, IFileChunkManifest> = new Map();
  
  // Netflix
  public genres: Map<string, IGenre> = new Map();
  public movies: Map<string, IMovie> = new Map();
  public series: Map<string, ISeries> = new Map();
  public seasons: Map<string, ISeason> = new Map();
  public episodes: Map<string, IEpisode> = new Map();
  public watchHistory: Map<string, IWatchHistory> = new Map();
  public watchlists: Map<string, IWatchlist> = new Map();

  // YouTube
  public channels: Map<string, IChannel> = new Map();
  public videos: Map<string, IVideo> = new Map();
  public videoComments: Map<string, IVideoComment> = new Map();
  public subscriptions: Map<string, ISubscription> = new Map();

  // Instagram
  public posts: Map<string, IPost> = new Map();
  public stories: Map<string, IStory> = new Map();
  public follows: Map<string, IFollow> = new Map();
  public directMessages: Map<string, IDirectMessage> = new Map();
  public notifications: Map<string, INotification> = new Map();

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData() {
    // 1. Initial Users (Super Admin, Creator, Normal User)
    const adminUser: IUser & { passwordHash: string } = {
      id: 'user-admin-1',
      email: 'admin@platform.io',
      username: 'admin',
      displayName: 'System Super Administrator',
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      passwordHash: 'admin123', // In production, verified with hash
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      isVerified: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.set(adminUser.id, adminUser);

    const creatorUser: IUser & { passwordHash: string } = {
      id: 'user-creator-1',
      email: 'creator@platform.io',
      username: 'cinematic_studios',
      displayName: 'Cinematic Studios',
      role: UserRole.CREATOR,
      status: UserStatus.ACTIVE,
      passwordHash: 'creator123',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      bio: 'Filmmakers, tech reviewers, and visual storytellers.',
      isVerified: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.set(creatorUser.id, creatorUser);

    // 2. Initial Multi-Account Storage Accounts & Buckets with 8 GB logical quotas
    const acc1: IStorageAccount & { secretAccessKey: string } = {
      id: 'acc-cloudflare-alpha',
      displayName: 'Cloudflare Account Alpha (West)',
      accountId: 'cf-alpha-9921',
      endpoint: 'https://cf-alpha-9921.r2.cloudflarestorage.com',
      accessKeyId: 'cf_key_alpha_prod',
      secretAccessKey: 'cf_secret_alpha_prod_enc',
      secretAccessKeyMasked: 'cf_sec...prod',
      status: StorageAccountStatus.ACTIVE,
      monthlyBudgetUsd: 100.0,
      currentEstimatedCostUsd: 4.5,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.storageAccounts.set(acc1.id, acc1);

    const acc2: IStorageAccount & { secretAccessKey: string } = {
      id: 'acc-cloudflare-beta',
      displayName: 'Cloudflare Account Beta (East)',
      accountId: 'cf-beta-4482',
      endpoint: 'https://cf-beta-4482.r2.cloudflarestorage.com',
      accessKeyId: 'cf_key_beta_prod',
      secretAccessKey: 'cf_secret_beta_prod_enc',
      secretAccessKeyMasked: 'cf_sec...prod',
      status: StorageAccountStatus.ACTIVE,
      monthlyBudgetUsd: 75.0,
      currentEstimatedCostUsd: 1.2,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.storageAccounts.set(acc2.id, acc2);

    // Buckets with strict 8 GiB Logical Quota
    const bucket1: IStorageBucket = {
      id: 'bkt-alpha-media-1',
      bucketName: 'prod-media-alpha-1',
      storageAccountId: acc1.id,
      region: 'auto',
      logicalQuotaBytes: DEFAULT_LOGICAL_QUOTA_BYTES, // 8 GiB = 8,589,934,592 bytes
      usedStorageBytes: 1073741824, // 1 GiB used
      reservedStorageBytes: 0,
      availableStorageBytes: DEFAULT_LOGICAL_QUOTA_BYTES - 1073741824,
      priority: 1,
      healthStatus: BucketHealthStatus.HEALTHY,
      isEnabled: true,
      objectCount: 42,
      lastValidatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.storageBuckets.set(bucket1.id, bucket1);

    const bucket2: IStorageBucket = {
      id: 'bkt-alpha-media-2',
      bucketName: 'prod-media-alpha-2',
      storageAccountId: acc1.id,
      region: 'auto',
      logicalQuotaBytes: DEFAULT_LOGICAL_QUOTA_BYTES, // 8 GiB
      usedStorageBytes: 0,
      reservedStorageBytes: 0,
      availableStorageBytes: DEFAULT_LOGICAL_QUOTA_BYTES,
      priority: 2,
      healthStatus: BucketHealthStatus.HEALTHY,
      isEnabled: true,
      objectCount: 0,
      lastValidatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.storageBuckets.set(bucket2.id, bucket2);

    const bucket3: IStorageBucket = {
      id: 'bkt-beta-media-1',
      bucketName: 'prod-media-beta-1',
      storageAccountId: acc2.id,
      region: 'auto',
      logicalQuotaBytes: DEFAULT_LOGICAL_QUOTA_BYTES, // 8 GiB
      usedStorageBytes: 0,
      reservedStorageBytes: 0,
      availableStorageBytes: DEFAULT_LOGICAL_QUOTA_BYTES,
      priority: 3,
      healthStatus: BucketHealthStatus.HEALTHY,
      isEnabled: true,
      objectCount: 0,
      lastValidatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.storageBuckets.set(bucket3.id, bucket3);

    // 3. Seed Netflix Content (Genres, Movies, Series, Episodes)
    const sciFiGenre: IGenre = { id: 'g-scifi', name: 'Sci-Fi & Cyberpunk', slug: 'sci-fi' };
    const actionGenre: IGenre = { id: 'g-action', name: 'Action & Adventure', slug: 'action' };
    const dramaGenre: IGenre = { id: 'g-drama', name: 'Drama', slug: 'drama' };
    this.genres.set(sciFiGenre.id, sciFiGenre);
    this.genres.set(actionGenre.id, actionGenre);
    this.genres.set(dramaGenre.id, dramaGenre);

    const movie1: IMovie = {
      id: 'mov-stellar-voyage',
      title: 'Stellar Horizon: 2099',
      description: 'An expedition beyond the solar boundary encounters an ancient spatial anomaly that alters time and memory.',
      releaseYear: 2026,
      durationMinutes: 142,
      rating: ContentRating.PG13,
      backdropUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1280',
      posterUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=500',
      trailerUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
      masterPlaylistUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
      audioTracks: [
        { language: 'en', label: 'English (Original 5.1)', url: 'audio/en.m3u8' },
        { language: 'es', label: 'Español', url: 'audio/es.m3u8' }
      ],
      subtitles: [
        { language: 'en', label: 'English [CC]', url: 'subs/en.vtt' },
        { language: 'es', label: 'Español', url: 'subs/es.vtt' }
      ],
      genres: [sciFiGenre, actionGenre],
      isFeatured: true,
      isTrending: true,
      viewsCount: 489200,
      createdAt: new Date()
    };
    this.movies.set(movie1.id, movie1);

    const series1: ISeries = {
      id: 'ser-neo-tokyo',
      title: 'Neon Odyssey',
      description: 'Under the perpetual neon rain of a synthetic metropolis, rogue detectives uncover a covert algorithmic rebellion.',
      releaseYear: 2025,
      rating: ContentRating.TV_MA,
      backdropUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1280',
      posterUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=500',
      genres: [sciFiGenre, dramaGenre],
      seasonsCount: 1,
      isFeatured: true,
      isTrending: true,
      createdAt: new Date()
    };
    this.series.set(series1.id, series1);

    const ep1: IEpisode = {
      id: 'ep-neo-s1-e1',
      seasonId: 'season-1',
      episodeNumber: 1,
      title: 'Signal in the Void',
      overview: 'Detective Ren intercepts an encrypted telemetry signal from a ghost satellite.',
      durationMinutes: 54,
      stillUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600',
      masterPlaylistUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
      subtitles: [{ language: 'en', label: 'English [CC]', url: 'subs/en.vtt' }],
      audioTracks: [{ language: 'en', label: 'English (Original)', url: 'audio/en.m3u8' }]
    };
    this.episodes.set(ep1.id, ep1);

    // 4. Seed YouTube Channel & Videos
    const channel1: IChannel = {
      id: 'chan-cinematic',
      userId: creatorUser.id,
      handle: '@CinematicStudios',
      title: 'Cinematic Studios Official',
      description: 'High-end cinema camera breakdowns, color grading tutorials, and indie film productions.',
      avatarUrl: creatorUser.avatarUrl!,
      bannerUrl: 'https://images.unsplash.com/photo-1518173946687-a4c8a383392e?w=1280',
      subscriberCount: 145000,
      videoCount: 28,
      totalViews: 3200000,
      createdAt: new Date()
    };
    this.channels.set(channel1.id, channel1);

    const ytVideo1: IVideo = {
      id: 'yt-distributed-storage-r2',
      channelId: channel1.id,
      channel: channel1,
      title: 'Building a Distributed 20GB Video Storage Engine with Cloudflare R2',
      description: 'A deep architectural dive into multi-account sequential bucket allocation and range streaming.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800',
      masterPlaylistUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      durationSeconds: 840,
      viewsCount: 12480,
      likesCount: 940,
      dislikesCount: 12,
      commentCount: 48,
      visibility: VideoVisibility.PUBLIC,
      isShort: false,
      tags: ['Cloudflare', 'R2', 'Streaming', 'Distributed Systems'],
      createdAt: new Date()
    };
    this.videos.set(ytVideo1.id, ytVideo1);

    const ytShort1: IVideo = {
      id: 'yt-short-hdr-grading',
      channelId: channel1.id,
      channel: channel1,
      title: '3 Color Grading Tricks for Cinematic Contrast! #Shorts',
      description: 'How to shape luminance in DaVinci Resolve.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800',
      masterPlaylistUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      durationSeconds: 45,
      viewsCount: 89400,
      likesCount: 6800,
      dislikesCount: 30,
      commentCount: 120,
      visibility: VideoVisibility.PUBLIC,
      isShort: true,
      tags: ['Shorts', 'Editing', 'Filmmaking'],
      createdAt: new Date()
    };
    this.videos.set(ytShort1.id, ytShort1);

    // 5. Seed Instagram Posts, Stories & Reels
    const igPost1: IPost = {
      id: 'post-onset-rig',
      userId: creatorUser.id,
      user: {
        id: creatorUser.id,
        username: creatorUser.username,
        displayName: creatorUser.displayName,
        avatarUrl: creatorUser.avatarUrl,
        isVerified: true
      },
      caption: 'Golden hour anamorphic rig on location in the Mojave Desert. 🌅🎥 What is your go-to cinema glass?',
      location: 'Mojave Desert, California',
      likesCount: 3412,
      commentsCount: 89,
      isReel: false,
      createdAt: new Date(),
      media: [
        {
          id: 'pm-1',
          mediaType: PostMediaType.IMAGE,
          url: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=1080',
          aspectRatio: 1.0,
          width: 1080,
          height: 1080
        }
      ]
    };
    this.posts.set(igPost1.id, igPost1);

    const igStory1: IStory = {
      id: 'story-render-farm',
      userId: creatorUser.id,
      user: {
        id: creatorUser.id,
        username: creatorUser.username,
        displayName: creatorUser.displayName,
        avatarUrl: creatorUser.avatarUrl
      },
      mediaUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800',
      mediaType: PostMediaType.IMAGE,
      durationSeconds: 15,
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000), // 24 hours lifecycle
      createdAt: new Date()
    };
    this.stories.set(igStory1.id, igStory1);
  }
}
