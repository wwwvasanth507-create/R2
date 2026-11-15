import {
  IPost,
  IStory,
  IFollow,
  IDirectMessage,
  INotification,
  PostMediaType
} from '@platform/common';
import { DatabaseService } from '../database/db.service';

export class InstagramService {
  constructor(private readonly db: DatabaseService) {}

  public getFeed(currentUserId?: string): IPost[] {
    const posts = Array.from(this.db.posts.values()).filter((p) => !p.isReel);
    return posts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  public getReels(): IPost[] {
    const reels = Array.from(this.db.posts.values()).filter((p) => p.isReel);
    return reels.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  public getActiveStories(): IStory[] {
    const now = new Date();
    return Array.from(this.db.stories.values()).filter((s) => s.expiresAt > now);
  }

  public createPost(
    userId: string,
    caption: string,
    location: string | undefined,
    mediaItems: { url: string; mediaType: PostMediaType; aspectRatio?: number }[],
    isReel = false
  ): IPost {
    const user = this.db.users.get(userId);
    const post: IPost = {
      id: `post-${Date.now()}`,
      userId,
      user: user
        ? {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            isVerified: user.isVerified
          }
        : undefined,
      caption,
      location,
      likesCount: 0,
      commentsCount: 0,
      isReel,
      createdAt: new Date(),
      media: mediaItems.map((m, idx) => ({
        id: `pm-${Date.now()}-${idx}`,
        mediaType: m.mediaType,
        url: m.url,
        aspectRatio: m.aspectRatio || 1.0,
        width: 1080,
        height: 1080
      }))
    };

    this.db.posts.set(post.id, post);
    return post;
  }

  public createStory(userId: string, mediaUrl: string, mediaType: PostMediaType): IStory {
    const user = this.db.users.get(userId);
    const story: IStory = {
      id: `story-${Date.now()}`,
      userId,
      user: user
        ? {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl
          }
        : undefined,
      mediaUrl,
      mediaType,
      durationSeconds: 15,
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000), // 24 hours lifecycle
      createdAt: new Date()
    };

    this.db.stories.set(story.id, story);
    return story;
  }

  public togglePostLike(postId: string): { likesCount: number } {
    const post = this.db.posts.get(postId);
    if (!post) throw new Error('Post not found.');

    post.likesCount = (post.likesCount || 0) + 1;
    return { likesCount: post.likesCount };
  }

  public toggleFollow(followerId: string, followingId: string): { isFollowing: boolean } {
    const key = `fol-${followerId}-${followingId}`;
    if (this.db.follows.has(key)) {
      this.db.follows.delete(key);
      return { isFollowing: false };
    } else {
      const follow: IFollow = {
        id: key,
        followerId,
        followingId,
        createdAt: new Date()
      };
      this.db.follows.set(key, follow);
      return { isFollowing: true };
    }
  }

  public sendMessage(senderId: string, recipientId: string, content: string): IDirectMessage {
    const convId = [senderId, recipientId].sort().join('_');
    const msg: IDirectMessage = {
      id: `msg-${Date.now()}`,
      conversationId: convId,
      senderId,
      recipientId,
      content,
      isRead: false,
      createdAt: new Date()
    };

    this.db.directMessages.set(msg.id, msg);
    return msg;
  }

  public getMessages(userId1: string, userId2: string): IDirectMessage[] {
    const convId = [userId1, userId2].sort().join('_');
    return Array.from(this.db.directMessages.values())
      .filter((m) => m.conversationId === convId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
}
