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
import { Pool } from 'pg';
import { config } from '../config/configuration';

export class DatabaseService {
  public pgPool: Pool | null = null;

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
    this.initPostgresPool();
    this.seedInitialData();
  }

  private initPostgresPool() {
    try {
      this.pgPool = new Pool({
        connectionString: config.databaseUrl,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 3000
      });
      this.pgPool.on('error', (err) => {
        console.warn('PostgreSQL pool background notice:', err.message);
      });
      this.loadStorageFromPostgres().catch(console.warn);
    } catch (err) {
      console.warn('PostgreSQL pool initialization failed, using in-memory store:', err);
    }
  }

  public async loadStorageFromPostgres(): Promise<void> {
    if (!this.pgPool) return;
    try {
      const accRes = await this.pgPool.query('SELECT * FROM storage_accounts');
      if (accRes.rows.length > 0) {
        this.storageAccounts.clear();
      }
      for (const row of accRes.rows) {
        const acc: IStorageAccount & { secretAccessKey: string } = {
          id: row.id,
          displayName: row.display_name,
          accountId: row.account_id,
          endpoint: row.endpoint,
          accessKeyId: row.access_key_id,
          secretAccessKey: row.secret_access_key_encrypted || 'cf_secret_prod',
          secretAccessKeyMasked: (row.secret_access_key_encrypted || 'cf_secret_prod').substring(0, 6) + '...prod',
          status: (row.status as StorageAccountStatus) || StorageAccountStatus.ACTIVE,
          monthlyBudgetUsd: parseFloat(row.monthly_budget_usd || '100'),
          currentEstimatedCostUsd: parseFloat(row.current_cost_usd || '0'),
          createdAt: row.created_at || new Date(),
          updatedAt: row.updated_at || new Date()
        };
        this.storageAccounts.set(acc.id, acc);
      }

      const bktRes = await this.pgPool.query('SELECT * FROM storage_buckets');
      if (bktRes.rows.length > 0) {
        this.storageBuckets.clear();
      }
      for (const row of bktRes.rows) {
        const quota = Number(row.logical_quota_bytes || DEFAULT_LOGICAL_QUOTA_BYTES);
        const used = Number(row.used_storage_bytes || 0);
        const bkt: IStorageBucket = {
          id: row.id,
          bucketName: row.bucket_name,
          storageAccountId: row.storage_account_id,
          region: row.region || 'auto',
          logicalQuotaBytes: quota,
          usedStorageBytes: used,
          reservedStorageBytes: Number(row.reserved_storage_bytes || 0),
          availableStorageBytes: Math.max(0, quota - used),
          priority: row.priority || 1,
          healthStatus: (row.health_status as BucketHealthStatus) || BucketHealthStatus.HEALTHY,
          isEnabled: row.is_enabled !== false,
          objectCount: Number(row.object_count || 0),
          createdAt: row.created_at || new Date(),
          updatedAt: row.updated_at || new Date()
        };
        this.storageBuckets.set(bkt.id, bkt);
      }
      console.log(`[POSTGRES] Synchronized ${accRes.rows.length} storage accounts and ${bktRes.rows.length} buckets from database.`);

      // Synchronize real videos from PostgreSQL
      const vidRes = await this.pgPool.query('SELECT * FROM videos ORDER BY created_at DESC');
      if (vidRes.rows.length > 0) {
        this.videos.clear();
        for (const row of vidRes.rows) {
          const video: IVideo = {
            id: row.id,
            channelId: row.channel_id,
            channel: {
              id: row.channel_id,
              userId: 'user-admin-1',
              title: 'VASANTH V',
              handle: '@vasanth',
              description: 'Official channel of VASANTH V',
              avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
              subscriberCount: 25000,
              videoCount: 1,
              totalViews: Number(row.views_count || 0),
              createdAt: row.created_at || new Date()
            },
            title: row.title,
            description: row.description || '',
            thumbnailUrl: row.thumbnail_url,
            masterPlaylistUrl: row.master_playlist_url,
            durationSeconds: row.duration_seconds || 180,
            viewsCount: Number(row.views_count || 0),
            likesCount: Number(row.likes_count || 0),
            dislikesCount: Number(row.dislikes_count || 0),
            commentCount: Number(row.comment_count || 0),
            visibility: (row.visibility as VideoVisibility) || VideoVisibility.PUBLIC,
            isShort: row.is_short || false,
            tags: row.tags || [],
            createdAt: row.created_at || new Date()
          };
          this.videos.set(video.id, video);
        }
        console.log(`[POSTGRES] Synchronized ${vidRes.rows.length} real videos from database.`);
      }

      // Synchronize real files from PostgreSQL
      const fileRes = await this.pgPool.query('SELECT * FROM files');
      if (fileRes.rows.length > 0) {
        this.files.clear();
        this.fileChunks.clear();
        const primaryBucket = this.storageBuckets.values().next().value;
        for (const row of fileRes.rows) {
          const size = Number(row.total_size_bytes);
          const sanitizedFilename = (row.original_filename || 'video.mp4').replace(/[^a-zA-Z0-9._-]/g, '_');
          const thumbMatch = row.original_filename ? row.original_filename.match(/^thumb-([a-f0-9-]+)\./) : null;
          const thumbUuid = thumbMatch ? thumbMatch[1] : row.id.replace(/^thumb-/, '');
          const objectKey = (row.original_filename && (row.original_filename.startsWith('thumb-') || row.original_filename.includes('thumb')))
            ? `thumbnails/${thumbUuid}.jpg`
            : `videos/${row.id}/${sanitizedFilename}`;

          const chunk: IFileChunkManifest = {
            id: `chk-${row.id}-0`,
            fileId: row.id,
            chunkIndex: 0,
            byteStart: 0,
            byteEnd: Math.max(0, size - 1),
            chunkSizeBytes: size,
            bucketId: primaryBucket ? primaryBucket.id : 'c0000000-0000-0000-0000-000000000001',
            bucketName: primaryBucket ? primaryBucket.bucketName : 'vasanth01-r2',
            storageAccountId: primaryBucket ? primaryBucket.storageAccountId : 'b0000000-0000-0000-0000-794756325126',
            objectKey: objectKey,
            status: ChunkUploadStatus.VERIFIED,
            verifiedAt: new Date()
          };

          const fileManifest: IFileManifest = {
            id: row.id,
            ownerId: row.owner_id,
            originalFilename: row.original_filename,
            mimeType: row.mime_type,
            totalSizeBytes: size,
            totalSha256Checksum: row.total_sha256_checksum,
            chunkCount: 1,
            chunkSizeBytes: size,
            uploadStatus: (row.upload_status as FileUploadStatus) || FileUploadStatus.READY,
            processingStatus: VideoProcessingStatus.COMPLETED,
            isDistributed: false,
            createdAt: row.created_at || new Date(),
            updatedAt: row.updated_at || new Date(),
            chunks: [chunk]
          };

          this.files.set(fileManifest.id, fileManifest);
          if (row.original_filename && row.original_filename.startsWith('thumb-')) {
            const friendlyThumbId = row.original_filename.replace(/\.[^/.]+$/, '');
            this.files.set(friendlyThumbId, fileManifest);
          }
          this.fileChunks.set(chunk.id, chunk);
        }
        console.log(`[POSTGRES] Synchronized ${fileRes.rows.length} real files from database.`);
      }
    } catch (err: any) {
      console.warn('[POSTGRES] Storage synchronization notice:', err.message);
    }
  }

  public async saveVideoToPostgres(video: IVideo, fileId?: string): Promise<void> {
    if (!this.pgPool) return;
    try {
      const channelId = video.channelId && video.channelId.includes('-') && video.channelId.length === 36
        ? video.channelId
        : 'c0000000-0000-0000-0000-000000000001';

      const userId = video.channel?.userId && video.channel.userId.includes('-') && video.channel.userId.length === 36
        ? video.channel.userId
        : 'a0000000-0000-0000-0000-000000000001';

      const channelRes = await this.pgPool.query(
        `INSERT INTO channels (id, user_id, handle, title, description, avatar_url, subscriber_count, video_count, total_views)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (user_id) DO UPDATE SET video_count = channels.video_count + 1
         RETURNING id;`,
        [
          channelId,
          userId,
          video.channel?.handle || '@creator',
          video.channel?.title || 'Creator Channel',
          video.channel?.description || '',
          video.channel?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          video.channel?.subscriberCount || 0,
          1,
          0
        ]
      );
      const actualChannelId = channelRes.rows && channelRes.rows[0] ? channelRes.rows[0].id : channelId;

      const videoDbId = video.id && video.id.includes('-') && video.id.length === 36
        ? video.id
        : 'v0000000-0000-0000-0000-' + String(Date.now()).slice(-12).padStart(12, '0');

      await this.pgPool.query(
        `INSERT INTO videos (
           id, channel_id, file_id, title, description, thumbnail_url, master_playlist_url,
           duration_seconds, views_count, likes_count, dislikes_count, comment_count,
           is_short, visibility, tags, created_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           thumbnail_url = EXCLUDED.thumbnail_url,
           master_playlist_url = EXCLUDED.master_playlist_url;`,
        [
          videoDbId,
          actualChannelId,
          fileId && fileId.length === 36 ? fileId : null,
          video.title,
          video.description,
          video.thumbnailUrl,
          video.masterPlaylistUrl,
          video.durationSeconds,
          video.viewsCount,
          video.likesCount,
          video.dislikesCount,
          video.commentCount,
          video.isShort,
          video.visibility,
          video.tags
        ]
      );
      console.log(`[POSTGRES] Video "${video.title}" persisted to PostgreSQL 'videos' table.`);
    } catch (err: any) {
      console.warn('[POSTGRES] Video persistence notice:', err.message);
    }
  }

  public async saveFileToPostgres(file: IFileManifest): Promise<void> {
    if (!this.pgPool) return;
    try {
      const fileDbId = file.id && file.id.includes('-') && file.id.length === 36
        ? file.id
        : 'f0000000-0000-0000-0000-' + String(Date.now()).slice(-12).padStart(12, '0');

      const ownerDbId = file.ownerId && file.ownerId.includes('-') && file.ownerId.length === 36
        ? file.ownerId
        : 'a0000000-0000-0000-0000-000000000001';

      await this.pgPool.query(
        `INSERT INTO files (id, owner_id, original_filename, mime_type, total_size_bytes, total_sha256_checksum, chunk_count, chunk_size_bytes, upload_status, is_distributed)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE SET
           upload_status = EXCLUDED.upload_status;`,
        [
          fileDbId,
          ownerDbId,
          file.originalFilename,
          file.mimeType,
          file.totalSizeBytes,
          file.totalSha256Checksum || '',
          file.chunkCount,
          file.chunkSizeBytes,
          file.uploadStatus,
          file.isDistributed
        ]
      );
      console.log(`[POSTGRES] File "${file.originalFilename}" (${file.totalSizeBytes} bytes) persisted to PostgreSQL 'files' table.`);
    } catch (err: any) {
      console.warn('[POSTGRES] File persistence notice:', err.message);
    }
  }

  private seedInitialData() {
    // 1. Initial Users (Super Admin, Creator, Normal User)
    const adminUser: IUser & { passwordHash: string } = {
      id: 'user-admin-1',
      email: 'vasanth@wavemusic.dpdns.org',
      username: 'VASANTH V',
      displayName: 'VASANTH V',
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      passwordHash: 'VASAnth@2008',
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

    // 2. Initial Multi-Account Storage Accounts & strictly 1 R2 bucket per account (8 GiB logical quota)
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

    // Initial 1 R2 bucket of 8 GiB logical quota per Cloudflare account
    const bkt1: IStorageBucket = {
      id: 'c0000000-0000-0000-0000-000000000001',
      bucketName: 'wavemusic-r2-media-1',
      storageAccountId: acc1.id,
      region: 'auto',
      logicalQuotaBytes: 8589934592, // 8 GiB
      usedStorageBytes: 0,
      reservedStorageBytes: 0,
      availableStorageBytes: 8589934592,
      priority: 1,
      healthStatus: BucketHealthStatus.HEALTHY,
      isEnabled: true,
      objectCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.storageBuckets.set(bkt1.id, bkt1);

    const bkt2: IStorageBucket = {
      id: 'c0000000-0000-0000-0000-000000000002',
      bucketName: 'wavemusic-r2-media-2',
      storageAccountId: acc2.id,
      region: 'auto',
      logicalQuotaBytes: 8589934592, // 8 GiB
      usedStorageBytes: 0,
      reservedStorageBytes: 0,
      availableStorageBytes: 8589934592,
      priority: 2,
      healthStatus: BucketHealthStatus.HEALTHY,
      isEnabled: true,
      objectCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.storageBuckets.set(bkt2.id, bkt2);

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
