import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { DatabaseService } from './database/db.service';
import { StorageManagerService } from './services/storage-manager.service';
import { UploadService } from './services/upload.service';
import { VideoTranscodingService } from './services/video-transcoding.service';
import { AuthService } from './services/auth.service';
import { NetflixService } from './services/netflix.service';
import { YouTubeService } from './services/youtube.service';
import { InstagramService } from './services/instagram.service';
import { AdminService } from './services/admin.service';
import { config } from './config/configuration';
import { UserRole } from '@platform/common';

const app = express();

app.use(cors({ origin: '*', credentials: true }));
// Bounded body parser for standard JSON APIs
app.use(express.json({ limit: '10mb' }));

// Initialize services
const db = new DatabaseService();
const storageManager = new StorageManagerService(db);
const uploadService = new UploadService(db, storageManager);
const transcodingService = new VideoTranscodingService(db, storageManager);
const authService = new AuthService(db);
const netflixService = new NetflixService(db);
const youtubeService = new YouTubeService(db);
const instagramService = new InstagramService(db);
const adminService = new AdminService(db, storageManager);

// Auth helper middleware
function getAuthUser(req: Request) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      return authService.verifyAccessToken(token);
    } catch {
      // Ignored
    }
  }
  return null;
}

// RBAC Authorization Guard Middleware
function requireRoles(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authUser = getAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ error: 'Authentication required. Missing or invalid Bearer token.' });
    }
    if (roles.length > 0 && !roles.includes(authUser.role)) {
      return res.status(403).json({
        error: `Forbidden: role '${authUser.role}' does not have required permissions [${roles.join(', ')}]`
      });
    }
    (req as any).user = authUser;
    next();
  };
}

// --- Health Check ---
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'HEALTHY',
    service: 'All-in-One Media Platform Backend',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    metrics: storageManager.getStorageMetrics()
  });
});

// --- Auth Endpoints ---
app.post('/api/auth/register', (req: Request, res: Response) => {
  try {
    const { email, username, password, displayName, role } = req.body;
    const result = authService.register(email, username, password, displayName, role);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  try {
    const { emailOrUsername, password } = req.body;
    const result = authService.login(emailOrUsername, password);
    res.json(result);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

app.get('/api/auth/me', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const user = db.users.get(authUser.sub);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ user });
});

// --- Storage & Uploads Endpoints ---
app.post('/api/uploads/sessions', async (req: Request, res: Response) => {
  try {
    const authUser = getAuthUser(req);
    const ownerId = authUser ? authUser.sub : 'user-anon-guest';
    const plan = await uploadService.createUploadSession(ownerId, req.body);
    res.status(201).json(plan);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/uploads/chunks/verify', async (req: Request, res: Response) => {
  try {
    const result = await uploadService.verifyAndCompleteChunk(req.body);
    if (result.isFileReady) {
      // Auto-trigger video transcoding pipeline
      transcodingService.processVideo(req.body.fileId).catch(console.error);
    }
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/uploads/sessions/:id/status', (req: Request, res: Response) => {
  try {
    const status = uploadService.getUploadSessionStatus(req.params.id);
    res.json(status);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// Resume an interrupted upload session: returns fresh presigned URLs for pending/failed chunks
app.post('/api/uploads/sessions/:id/resume', async (req: Request, res: Response) => {
  try {
    const session = await uploadService.getResumableUploadSession(req.params.id);
    res.json(session);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// HTTP HEAD request for distributed file metadata
app.head('/api/files/:id/download', async (req: Request, res: Response) => {
  try {
    const file = db.files.get(req.params.id);
    if (!file) {
      return res.status(404).end();
    }
    const headResult = storageManager.rangeGateway.handleHeadRequest(file);
    res.status(headResult.statusCode);
    for (const [key, val] of Object.entries(headResult.headers)) {
      res.setHeader(key, val);
    }
    res.end();
  } catch (err: any) {
    res.status(500).end();
  }
});

// Seamless HTTP Range Virtual Reassembly Download Gateway!
app.get('/api/files/:id/download', async (req: Request, res: Response) => {
  try {
    const file = db.files.get(req.params.id);
    if (!file) {
      return res.status(404).json({ error: 'File not found.' });
    }

    const rangeHeader = req.headers.range;
    const downloadResult = await storageManager.rangeGateway.handleDownloadRequest(
      file,
      rangeHeader
    );

    res.status(downloadResult.statusCode);
    for (const [key, val] of Object.entries(downloadResult.headers)) {
      res.setHeader(key, val);
    }
    downloadResult.stream.pipe(res);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Mock direct-to-R2 upload handler (for zero-credential local test suites)
app.put('/api/storage/mock-upload/:bucket/:key(*)', async (req: Request, res: Response) => {
  try {
    const { bucket, key } = req.params;
    const provider = storageManager.getProvider('local-account');
    await provider.putObject(bucket, key, req, req.headers['content-type'] || 'application/octet-stream');
    res.status(200).json({ success: true, etag: `"mock-${Date.now()}"` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Netflix Endpoints ---
app.get('/api/netflix/featured', (req: Request, res: Response) => {
  res.json(netflixService.getFeaturedContent());
});

app.get('/api/netflix/genres', (req: Request, res: Response) => {
  res.json(netflixService.getGenres());
});

app.get('/api/netflix/movies', (req: Request, res: Response) => {
  const { genre, search } = req.query;
  res.json(netflixService.getMovies(genre as string, search as string));
});

app.get('/api/netflix/movies/:id', (req: Request, res: Response) => {
  const movie = netflixService.getMovieById(req.params.id);
  if (!movie) return res.status(404).json({ error: 'Movie not found' });
  res.json(movie);
});

app.get('/api/netflix/series', (req: Request, res: Response) => {
  const { search } = req.query;
  res.json(netflixService.getSeries(search as string));
});

app.get('/api/netflix/series/:id', (req: Request, res: Response) => {
  const series = netflixService.getSeriesById(req.params.id);
  if (!series) return res.status(404).json({ error: 'Series not found' });
  res.json(series);
});

app.get('/api/netflix/watch-history', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  const userId = authUser ? authUser.sub : 'user-admin-1';
  res.json(netflixService.getWatchHistory(userId));
});

app.post('/api/netflix/watch-history', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  const userId = authUser ? authUser.sub : 'user-admin-1';
  const { mediaType, mediaId, progressSeconds, totalDurationSeconds } = req.body;
  const result = netflixService.updateWatchProgress(
    userId,
    mediaType,
    mediaId,
    progressSeconds,
    totalDurationSeconds
  );
  res.json(result);
});

// --- YouTube Endpoints ---
app.get('/api/youtube/videos', (req: Request, res: Response) => {
  const { search, tag } = req.query;
  res.json(youtubeService.getVideos(search as string, tag as string));
});

app.get('/api/youtube/shorts', (req: Request, res: Response) => {
  res.json(youtubeService.getShorts());
});

app.get('/api/youtube/videos/:id', (req: Request, res: Response) => {
  const video = youtubeService.getVideoById(req.params.id);
  if (!video) return res.status(404).json({ error: 'Video not found' });
  res.json(video);
});

app.post('/api/youtube/videos/:id/comments', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  const userId = authUser ? authUser.sub : 'user-creator-1';
  const { content, parentId } = req.body;
  const comment = youtubeService.addComment(req.params.id, userId, content, parentId);
  res.status(201).json(comment);
});

app.post('/api/youtube/videos/:id/like', (req: Request, res: Response) => {
  const { isLike } = req.body;
  res.json(youtubeService.toggleLike(req.params.id, Boolean(isLike)));
});

app.get('/api/youtube/channels/:id', (req: Request, res: Response) => {
  const channel = youtubeService.getChannel(req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  res.json(channel);
});

app.post('/api/youtube/channels/:id/subscribe', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  const userId = authUser ? authUser.sub : 'user-admin-1';
  res.json(youtubeService.toggleSubscription(userId, req.params.id));
});

// --- Instagram Endpoints ---
app.get('/api/instagram/feed', (req: Request, res: Response) => {
  res.json(instagramService.getFeed());
});

app.get('/api/instagram/reels', (req: Request, res: Response) => {
  res.json(instagramService.getReels());
});

app.get('/api/instagram/stories', (req: Request, res: Response) => {
  res.json(instagramService.getActiveStories());
});

app.post('/api/instagram/posts', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  const userId = authUser ? authUser.sub : 'user-creator-1';
  const { caption, location, mediaItems, isReel } = req.body;
  const post = instagramService.createPost(userId, caption, location, mediaItems, isReel);
  res.status(201).json(post);
});

app.post('/api/instagram/posts/:id/like', (req: Request, res: Response) => {
  res.json(instagramService.togglePostLike(req.params.id));
});

app.post('/api/instagram/follow/:id', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  const followerId = authUser ? authUser.sub : 'user-admin-1';
  res.json(instagramService.toggleFollow(followerId, req.params.id));
});

app.get('/api/instagram/messages/:userId', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  const currentUserId = authUser ? authUser.sub : 'user-admin-1';
  res.json(instagramService.getMessages(currentUserId, req.params.userId));
});

app.post('/api/instagram/messages', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  const senderId = authUser ? authUser.sub : 'user-admin-1';
  const { recipientId, content } = req.body;
  res.status(201).json(instagramService.sendMessage(senderId, recipientId, content));
});

// --- Admin Dashboard Endpoints (Protected with RBAC) ---
app.get(
  '/api/admin/overview',
  requireRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.AUDITOR),
  (req: Request, res: Response) => {
    res.json(adminService.getDashboardOverview());
  }
);

app.get(
  '/api/admin/accounts',
  requireRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.AUDITOR),
  (req: Request, res: Response) => {
    res.json(adminService.getAccounts());
  }
);

app.post(
  '/api/admin/accounts',
  requireRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  async (req: Request, res: Response) => {
    try {
      const account = await adminService.addStorageAccount(req.body);
      res.status(201).json(account);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
);

app.get(
  '/api/admin/buckets',
  requireRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.AUDITOR),
  (req: Request, res: Response) => {
    res.json(adminService.getBuckets());
  }
);

app.post(
  '/api/admin/buckets',
  requireRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  (req: Request, res: Response) => {
    try {
      const bucket = adminService.addBucket(req.body);
      res.status(201).json(bucket);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
);

app.patch(
  '/api/admin/buckets/:id',
  requireRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  (req: Request, res: Response) => {
    try {
      const bucket = adminService.updateBucket(req.params.id, req.body);
      res.json(bucket);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
);

app.get(
  '/api/admin/alerts',
  requireRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.AUDITOR),
  (req: Request, res: Response) => {
    res.json(adminService.getAlerts());
  }
);

app.post(
  '/api/admin/alerts/:id/resolve',
  requireRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  (req: Request, res: Response) => {
    try {
      res.json(adminService.resolveAlert(req.params.id));
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
);

app.get(
  '/api/admin/users',
  requireRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MODERATOR, UserRole.AUDITOR),
  (req: Request, res: Response) => {
    res.json(adminService.getUsers());
  }
);

app.patch(
  '/api/admin/users/:id/role',
  requireRoles(UserRole.SUPER_ADMIN),
  (req: Request, res: Response) => {
    try {
      res.json(adminService.updateUserRole(req.params.id, req.body.role as UserRole));
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
);

app.patch(
  '/api/admin/users/:id/status',
  requireRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MODERATOR),
  (req: Request, res: Response) => {
    try {
      res.json(adminService.updateUserStatus(req.params.id, req.body.status));
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
);

// --- Video Transcoding & HLS Manifest Proxy ---
app.post('/api/transcoding/process/:fileId', async (req: Request, res: Response) => {
  try {
    const result = await transcodingService.processVideo(req.params.fileId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/streaming/manifest/:fileId/master.m3u8', (req: Request, res: Response) => {
  const masterManifest = transcodingService.generateMasterPlaylist(req.params.fileId, [
    '360p',
    '720p',
    '1080p'
  ]);
  res.setHeader('Content-Type', 'application/x-mpegURL');
  res.send(masterManifest);
});

export { app };

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`🚀 Production Media Platform Backend listening on port ${config.port}`);
  });
}
