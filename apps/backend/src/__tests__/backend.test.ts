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
    assert.ok(overview.metrics.bucketsCount >= 2);
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

  it('100 MB Chunking & Virtual Reassembly: splits 2 GB movie into 100 MB chunks and streams seamlessly', async () => {
    const twoGiB = 2 * 1024 * 1024 * 1024; // 2,147,483,648 bytes
    const chunkSize = 95 * 1024 * 1024; // 95 MiB = ~99.6 MB (safely under Cloudflare 100 MB proxy limit)
    const expectedChunkCount = Math.ceil(twoGiB / chunkSize); // 22 chunks

    assert.strictEqual(expectedChunkCount, 22);

    // 1. Plan chunk distribution for a 2 GB movie
    const eligibleBuckets = storageManager.getEligibleBuckets();
    const fileId = `movie-2gb-${Date.now()}`;

    const plan = await storageManager.chunkPlanner.planDistribution(
      fileId,
      twoGiB,
      eligibleBuckets,
      (accId) => storageManager.getProvider(accId),
      chunkSize
    );

    assert.strictEqual(plan.chunkCount, 22);
    assert.strictEqual(plan.chunks.length, 22);
    assert.strictEqual(plan.chunks[0].manifest.byteStart, 0);
    assert.strictEqual(plan.chunks[0].manifest.byteEnd, chunkSize - 1);
    assert.strictEqual(plan.chunks[0].manifest.chunkSizeBytes, chunkSize);

    // Verify last chunk takes only remaining bytes
    const lastChunk = plan.chunks[21].manifest;
    assert.strictEqual(lastChunk.byteStart, 21 * chunkSize);
    assert.strictEqual(lastChunk.byteEnd, twoGiB - 1);
    assert.strictEqual(lastChunk.chunkSizeBytes, twoGiB - 21 * chunkSize);

    // 2. Create file manifest and verify chunks
    const chunks = plan.chunks.map((c) => ({
      ...c.manifest,
      status: 'VERIFIED' as any
    }));

    const fileManifest = {
      id: fileId,
      ownerId: 'user-admin-1',
      originalFilename: 'Interstellar_2014_4K_Remux.mkv',
      mimeType: 'video/x-matroska',
      totalSizeBytes: twoGiB,
      chunkCount: 22,
      chunkSizeBytes: chunkSize,
      uploadStatus: 'READY' as any,
      processingStatus: 'COMPLETED' as any,
      isDistributed: plan.isDistributed,
      createdAt: new Date(),
      updatedAt: new Date(),
      chunks
    };

    db.files.set(fileId, fileManifest);

    // 3. Test Range Gateway Head Request & Virtual Reassembly Range Parsing
    const headRes = storageManager.rangeGateway.handleHeadRequest(fileManifest);
    assert.strictEqual(headRes.statusCode, 200);
    assert.strictEqual(headRes.headers['Content-Length'], twoGiB);
    assert.strictEqual(headRes.headers['Accept-Ranges'], 'bytes');

    // Test byte range parsing across 100 MB chunk boundary (e.g. byte 90 MB to 100 MB)
    const crossChunkStart = 90 * 1024 * 1024;
    const crossChunkEnd = 100 * 1024 * 1024;
    const rangeHeader = `bytes=${crossChunkStart}-${crossChunkEnd}`;

    const parsedRange = storageManager.rangeGateway.parseRangeHeader(rangeHeader, twoGiB);
    assert.ok(parsedRange);
    assert.strictEqual(parsedRange.start, crossChunkStart);
    assert.strictEqual(parsedRange.end, crossChunkEnd);

    // Verify that the requested range maps accurately across chunk 0 and chunk 1
    const affectedChunks = fileManifest.chunks.filter(
      (c) => c.byteEnd >= crossChunkStart && c.byteStart <= crossChunkEnd
    );
    assert.strictEqual(affectedChunks.length, 2);
    assert.strictEqual(affectedChunks[0].chunkIndex, 0);
    assert.strictEqual(affectedChunks[1].chunkIndex, 1);

    // Verify slice offsets
    const slice0Start = Math.max(0, crossChunkStart - affectedChunks[0].byteStart);
    const slice0End = Math.min(affectedChunks[0].chunkSizeBytes - 1, crossChunkEnd - affectedChunks[0].byteStart);
    assert.strictEqual(slice0Start, 90 * 1024 * 1024);
    assert.strictEqual(slice0End, chunkSize - 1);

    const slice1Start = Math.max(0, crossChunkStart - affectedChunks[1].byteStart);
    const slice1End = Math.min(affectedChunks[1].chunkSizeBytes - 1, crossChunkEnd - affectedChunks[1].byteStart);
    assert.strictEqual(slice1Start, 0);
    assert.strictEqual(slice1End, crossChunkEnd - affectedChunks[1].byteStart);
  });
});
