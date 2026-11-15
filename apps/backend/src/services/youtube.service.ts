import crypto from 'crypto';
import {
  IVideo,
  IChannel,
  IVideoComment,
  ISubscription,
  VideoVisibility
} from '@platform/common';
import { DatabaseService } from '../database/db.service';

export interface CreateVideoInput {
  title: string;
  description?: string;
  thumbnailUrl?: string;
  masterPlaylistUrl: string;
  durationSeconds?: number;
  visibility?: VideoVisibility;
  isShort?: boolean;
  tags?: string[];
  fileId?: string;
}

export class YouTubeService {
  constructor(private readonly db: DatabaseService) {}

  public getVideos(search?: string, tag?: string): IVideo[] {
    let list = Array.from(this.db.videos.values()).filter(
      (v) => v.visibility === VideoVisibility.PUBLIC && !v.isShort
    );

    if (tag && tag !== 'All') {
      list = list.filter((v) => v.tags && v.tags.some((t) => t.toLowerCase() === tag.toLowerCase()));
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (v) => v.title.toLowerCase().includes(q) || (v.description && v.description.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list;
  }

  public getShorts(): IVideo[] {
    const list = Array.from(this.db.videos.values()).filter(
      (v) => v.visibility === VideoVisibility.PUBLIC && v.isShort
    );
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list;
  }

  public async createVideo(userId: string, data: CreateVideoInput): Promise<IVideo> {
    const user = this.db.users.get(userId);
    let channel = Array.from(this.db.channels.values()).find((c) => c.userId === userId);

    if (!channel) {
      const channelId = crypto.randomUUID();
      channel = {
        id: channelId,
        userId: user ? user.id : userId,
        handle: user ? `@${user.username.replace(/[^a-zA-Z0-9_]/g, '_')}` : `@creator_${Date.now().toString().slice(-4)}`,
        title: user ? user.displayName || user.username : 'Creator Channel',
        description: 'Creator channel on WaveMusic Media Platform',
        avatarUrl: user?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        subscriberCount: 0,
        videoCount: 0,
        totalViews: 0,
        createdAt: new Date()
      };
      this.db.channels.set(channel.id, channel);
    }

    const videoId = crypto.randomUUID();
    const video: IVideo = {
      id: videoId,
      channelId: channel.id,
      channel,
      title: data.title,
      description: data.description || '',
      thumbnailUrl: data.thumbnailUrl || 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800',
      masterPlaylistUrl: data.masterPlaylistUrl,
      durationSeconds: data.durationSeconds || 120,
      viewsCount: 0,
      likesCount: 0,
      dislikesCount: 0,
      commentCount: 0,
      visibility: data.visibility || VideoVisibility.PUBLIC,
      isShort: Boolean(data.isShort),
      tags: data.tags && data.tags.length > 0 ? data.tags : ['WaveMusic', 'Video'],
      createdAt: new Date()
    };

    channel.videoCount += 1;
    this.db.videos.set(videoId, video);

    // Persist to PostgreSQL if connected
    await this.db.saveVideoToPostgres(video, data.fileId);

    return video;
  }

  public getVideoById(id: string): (IVideo & { comments: IVideoComment[] }) | undefined {
    const video = this.db.videos.get(id);
    if (!video) return undefined;

    video.viewsCount = (video.viewsCount || 0) + 1;

    const comments = Array.from(this.db.videoComments.values())
      .filter((c) => c.videoId === id)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return { ...video, comments };
  }

  public addComment(videoId: string, userId: string, content: string, parentId?: string): IVideoComment {
    const user = this.db.users.get(userId);
    const comment: IVideoComment = {
      id: `comm-${Date.now()}`,
      videoId,
      userId,
      user: user
        ? {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl
          }
        : undefined,
      parentId,
      content,
      likesCount: 0,
      createdAt: new Date()
    };

    this.db.videoComments.set(comment.id, comment);

    const video = this.db.videos.get(videoId);
    if (video) {
      video.commentCount = (video.commentCount || 0) + 1;
    }

    return comment;
  }

  public toggleLike(videoId: string, isLike: boolean): { likesCount: number; dislikesCount: number } {
    const video = this.db.videos.get(videoId);
    if (!video) throw new Error('Video not found.');

    if (isLike) {
      video.likesCount = (video.likesCount || 0) + 1;
    } else {
      video.dislikesCount = (video.dislikesCount || 0) + 1;
    }

    return { likesCount: video.likesCount, dislikesCount: video.dislikesCount };
  }

  public getChannel(channelId: string): (IChannel & { videos: IVideo[] }) | undefined {
    const channel = this.db.channels.get(channelId);
    if (!channel) return undefined;

    const videos = Array.from(this.db.videos.values()).filter((v) => v.channelId === channelId);
    return { ...channel, videos };
  }

  public toggleSubscription(userId: string, channelId: string): { isSubscribed: boolean; subscriberCount: number } {
    const subKey = `sub-${userId}-${channelId}`;
    const channel = this.db.channels.get(channelId);
    if (!channel) throw new Error('Channel not found.');

    if (this.db.subscriptions.has(subKey)) {
      this.db.subscriptions.delete(subKey);
      channel.subscriberCount = Math.max(0, channel.subscriberCount - 1);
      return { isSubscribed: false, subscriberCount: channel.subscriberCount };
    } else {
      const sub: ISubscription = {
        id: subKey,
        userId,
        channelId,
        createdAt: new Date()
      };
      this.db.subscriptions.set(subKey, sub);
      channel.subscriberCount += 1;
      return { isSubscribed: true, subscriberCount: channel.subscriberCount };
    }
  }

  public async updateVideo(
    videoId: string,
    data: {
      title?: string;
      description?: string;
      thumbnailUrl?: string;
      category?: string;
      tags?: string[];
    }
  ): Promise<IVideo> {
    const video = this.db.videos.get(videoId);
    if (!video) throw new Error('Video not found.');

    if (data.title !== undefined) video.title = data.title;
    if (data.description !== undefined) video.description = data.description;
    if (data.thumbnailUrl !== undefined) video.thumbnailUrl = data.thumbnailUrl;
    if (data.tags !== undefined) {
      video.tags = data.tags;
    } else if (data.category !== undefined) {
      video.tags = [data.category, ...(video.tags?.filter((t) => t !== data.category) || [])];
    }

    if (this.db.pgPool) {
      try {
        await this.db.pgPool.query(
          `UPDATE videos 
           SET title = $1, description = $2, thumbnail_url = $3, tags = $4 
           WHERE id = $5`,
          [video.title, video.description, video.thumbnailUrl, video.tags, videoId]
        );
      } catch (err: any) {
        console.warn('[POSTGRES] Failed to update video in DB:', err.message);
      }
    }

    return video;
  }

  public async deleteVideo(videoId: string): Promise<{ success: boolean; message: string }> {
    const video = this.db.videos.get(videoId);
    if (!video) throw new Error('Video not found.');

    if (this.db.pgPool) {
      try {
        // Find fileId if any
        const fRes = await this.db.pgPool.query('SELECT file_id FROM videos WHERE id = $1', [videoId]);
        const fileId = fRes.rows[0]?.file_id;

        // Delete from videos table
        await this.db.pgPool.query('DELETE FROM videos WHERE id = $1', [videoId]);

        if (fileId) {
          // Find chunks
          const chunkRes = await this.db.pgPool.query('SELECT * FROM file_chunks WHERE file_id = $1', [fileId]);
          // Clean up PostgreSQL chunks and files
          await this.db.pgPool.query('DELETE FROM file_chunks WHERE file_id = $1', [fileId]);
          await this.db.pgPool.query('DELETE FROM files WHERE id = $1', [fileId]);

          this.db.files.delete(fileId);
          for (const c of chunkRes.rows) {
            this.db.fileChunks.delete(c.id);
          }
        }
      } catch (err: any) {
        console.warn('[POSTGRES] Error deleting video from DB:', err.message);
      }
    }

    this.db.videos.delete(videoId);
    return { success: true, message: `Video "${video.title}" permanently deleted.` };
  }
}
