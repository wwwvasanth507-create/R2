export enum VideoVisibility {
  PUBLIC = 'PUBLIC',
  UNLISTED = 'UNLISTED',
  PRIVATE = 'PRIVATE'
}

export interface IChannel {
  id: string;
  userId: string;
  handle: string;
  title: string;
  description: string;
  avatarUrl: string;
  bannerUrl?: string;
  subscriberCount: number;
  videoCount: number;
  totalViews: number;
  createdAt: Date;
}

export interface IVideo {
  id: string;
  channelId: string;
  channel?: IChannel;
  title: string;
  description: string;
  thumbnailUrl: string;
  masterPlaylistUrl: string; // HLS Master Playlist
  durationSeconds: number;
  viewsCount: number;
  likesCount: number;
  dislikesCount: number;
  commentCount: number;
  visibility: VideoVisibility;
  isShort: boolean; // YouTube Shorts flag
  tags: string[];
  createdAt: Date;
}

export interface IVideoComment {
  id: string;
  videoId: string;
  userId: string;
  user?: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
  parentId?: string; // For nested replies
  content: string;
  likesCount: number;
  createdAt: Date;
  replies?: IVideoComment[];
}

export interface ISubscription {
  id: string;
  userId: string;
  channelId: string;
  createdAt: Date;
}
