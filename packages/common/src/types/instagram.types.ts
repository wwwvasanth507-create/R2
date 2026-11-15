export enum PostMediaType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  CAROUSEL = 'CAROUSEL'
}

export interface IPostMediaItem {
  id: string;
  mediaType: PostMediaType;
  url: string; // Image URL or Video Master Playlist URL
  thumbnailUrl?: string;
  aspectRatio: number;
  width: number;
  height: number;
}

export interface IPost {
  id: string;
  userId: string;
  user?: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    isVerified: boolean;
  };
  caption: string;
  location?: string;
  likesCount: number;
  commentsCount: number;
  media: IPostMediaItem[];
  isReel: boolean; // Vertical short-form reel
  createdAt: Date;
  isLikedByMe?: boolean;
}

export interface IStory {
  id: string;
  userId: string;
  user?: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
  mediaUrl: string;
  mediaType: PostMediaType;
  durationSeconds: number;
  expiresAt: Date; // 24 hours lifecycle
  createdAt: Date;
}

export interface IFollow {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: Date;
}

export interface IDirectMessage {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  content: string;
  mediaUrl?: string;
  isRead: boolean;
  createdAt: Date;
}

export interface INotification {
  id: string;
  userId: string;
  actorId: string;
  actor?: {
    id: string;
    username: string;
    avatarUrl?: string;
  };
  type: 'LIKE' | 'COMMENT' | 'FOLLOW' | 'MENTION' | 'SYSTEM';
  entityId?: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}
