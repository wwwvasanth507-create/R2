import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { DatabaseService } from '../database/db.service';
import { StorageManagerService } from '../services/storage-manager.service';
import { UploadService } from '../services/upload.service';
import { AuthService } from '../services/auth.service';
import { NetflixService } from '../services/netflix.service';
import { YouTubeService } from '../services/youtube.service';
import { InstagramService } from '../services/instagram.service';
import { AdminService } from '../services/admin.service';
import {
  UserRole,
  MediaCategoryType,
  PostMediaType,
  DEFAULT_LOGICAL_QUOTA_BYTES
} from '@platform/common';

describe('Unified Backend API Integration Suite', () => {
  const db = new DatabaseService();
  const storageManager = new StorageManagerService(db);
  const uploadService = new UploadService(db, storageManager);
  const authService = new AuthService(db);
  const netflixService = new NetflixService(db);
  const youtubeService = new YouTubeService(db);
  const instagramService = new InstagramService(db);
  const adminService = new AdminService(db, storageManager);

  it('handles user registration, password hashing, and login authentication', () => {
    const reg = authService.register(
      'sarah@studio.com',
      'sarah_director',
      'SecurePass2026!',
      'Sarah Connor',
      UserRole.CREATOR
    );

    assert.strictEqual(reg.user.username, 'sarah_director');
    assert.strictEqual(reg.user.role, UserRole.CREATOR);
    assert.ok(reg.tokens.accessToken);
    assert.ok(reg.tokens.refreshToken);

    const loginRes = authService.login('sarah@studio.com', 'SecurePass2026!');
    assert.strictEqual(loginRes.user.id, reg.user.id);

    const tokenPayload = authService.verifyAccessToken(loginRes.tokens.accessToken);
    assert.strictEqual(tokenPayload.sub, reg.user.id);
  });

  it('creates large-file upload session, allocates across 8 GB quota buckets, and verifies chunks', async () => {
    // Simulate a 10 GiB file upload (requires multiple buckets under 8 GiB quota)
    const tenGiB = 10 * 1024 * 1024 * 1024;
    const session = await uploadService.createUploadSession('user-creator-1', {
      originalFilename: '4k_feature_film.mov',
      mimeType: 'video/quicktime',
      totalSizeBytes: tenGiB,
      totalSha256Checksum: 'mock-whole-file-sha256'
    });

    assert.strictEqual(session.totalSizeBytes, tenGiB);
    assert.ok(session.chunks.length > 1);
    assert.strictEqual(session.isDistributed, true); // Crossed bucket boundary!

    // Verify first chunk
    const firstChunk = session.chunks[0];
    const verifyRes = await uploadService.verifyAndCompleteChunk({
      fileId: session.fileId,
      chunkIndex: firstChunk.chunkIndex,
      chunkSha256Checksum: 'valid-chunk-0-sha256',
      actualSizeBytes: firstChunk.chunkSizeBytes
    });

    const status = uploadService.getUploadSessionStatus(session.fileId);
    assert.strictEqual(status.verifiedChunksCount, 1);
    assert.strictEqual(status.chunks[0].status, 'VERIFIED');
  });

  it('Netflix: retrieves featured content, updates continue watching and manages watchlist', () => {
    const featured = netflixService.getFeaturedContent();
    assert.ok(featured.movies.length > 0);

    const movie = featured.movies[0];
    const history = netflixService.updateWatchProgress(
      'user-admin-1',
      MediaCategoryType.MOVIE,
      movie.id,
      3600, // 1 hour into movie
      8520
    );

    assert.strictEqual(history.progressSeconds, 3600);
    assert.strictEqual(history.isCompleted, false);

    const watchlist = netflixService.addToWatchlist('user-admin-1', MediaCategoryType.MOVIE, movie.id);
    assert.strictEqual(watchlist.movieId, movie.id);

    const userWatchlist = netflixService.getWatchlist('user-admin-1');
    assert.ok(userWatchlist.some((w) => w.movieId === movie.id));
  });

  it('YouTube: retrieves videos, shorts, comments, and handles channel subscriptions', () => {
    const videos = youtubeService.getVideos();
    assert.ok(videos.length > 0);

    const shorts = youtubeService.getShorts();
    assert.ok(shorts.length > 0);
    assert.strictEqual(shorts[0].isShort, true);

    const targetVideo = videos[0];
    const comment = youtubeService.addComment(
      targetVideo.id,
      'user-admin-1',
      'The multi-account R2 architecture is brilliant!'
    );

    assert.strictEqual(comment.content, 'The multi-account R2 architecture is brilliant!');

    const fullVideo = youtubeService.getVideoById(targetVideo.id);
    assert.ok(fullVideo?.comments.some((c) => c.id === comment.id));

    // Subscription toggle
    const subRes = youtubeService.toggleSubscription('user-admin-1', targetVideo.channelId);
    assert.strictEqual(subRes.isSubscribed, true);
  });

  it('Instagram: feed, active stories, post creation, and direct messaging', () => {
    const feed = instagramService.getFeed();
    assert.ok(feed.length > 0);

    const stories = instagramService.getActiveStories();
    assert.ok(stories.length > 0);

    // Create post
    const newPost = instagramService.createPost(
      'user-creator-1',
      'Behind the scenes of our 8K documentary workflow 🎬',
      'Los Angeles, CA',
      [{ url: 'https://example.com/bts.jpg', mediaType: PostMediaType.IMAGE }]
    );
    assert.strictEqual(newPost.caption, 'Behind the scenes of our 8K documentary workflow 🎬');

    // Direct message
    const dm = instagramService.sendMessage(
      'user-creator-1',
      'user-admin-1',
      'Can you review the latest bucket allocation quota?'
    );
    assert.strictEqual(dm.content, 'Can you review the latest bucket allocation quota?');

    const thread = instagramService.getMessages('user-creator-1', 'user-admin-1');
    assert.ok(thread.some((m) => m.id === dm.id));
  });

  it('Admin: monitors storage metrics, adds dynamic buckets with 8 GB logical quota, updates quotas', () => {
    const overview = adminService.getDashboardOverview();
    assert.ok(overview.metrics.accountsCount >= 2);
    assert.ok(overview.metrics.bucketsCount >= 3);
    assert.ok(overview.counts.totalUsers >= 2);

    // Register a new dynamic bucket (zero client update required)
    const newBucket = adminService.addBucket({
      bucketName: 'prod-media-dynamic-charlie',
      storageAccountId: 'acc-cloudflare-alpha',
      logicalQuotaBytes: DEFAULT_LOGICAL_QUOTA_BYTES,
      priority: 5
    });

    assert.strictEqual(newBucket.bucketName, 'prod-media-dynamic-charlie');
    assert.strictEqual(newBucket.logicalQuotaBytes, DEFAULT_LOGICAL_QUOTA_BYTES);

    // Update logical quota
    const updated = adminService.updateBucket(newBucket.id, {
      logicalQuotaBytes: 10 * 1024 * 1024 * 1024 // Update to 10 GiB
    });
    assert.strictEqual(updated.logicalQuotaBytes, 10737418240);
  });
});
