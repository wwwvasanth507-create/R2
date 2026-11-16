package com.vdplayer.app.model;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class Video implements Serializable {
    private String id;
    private String title;
    private String description;
    private String thumbnailUrl;
    private String masterPlaylistUrl;
    private int durationSeconds;
    private int viewsCount;
    private int likesCount;
    private String channelTitle;
    private String channelAvatar;
    private String category;
    private List<String> tags = new ArrayList<>();

    public Video() {}

    public Video(String id, String title, String description, String thumbnailUrl,
                 String masterPlaylistUrl, int durationSeconds, int viewsCount,
                 int likesCount, String channelTitle, String channelAvatar,
                 String category, List<String> tags) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.thumbnailUrl = thumbnailUrl;
        this.masterPlaylistUrl = masterPlaylistUrl;
        this.durationSeconds = durationSeconds;
        this.viewsCount = viewsCount;
        this.likesCount = likesCount;
        this.channelTitle = channelTitle;
        this.channelAvatar = channelAvatar;
        this.category = category;
        if (tags != null) this.tags = tags;
    }

    public String getId() { return id != null ? id : ""; }
    public void setId(String id) { this.id = id; }

    public String getTitle() { return title != null ? title : "Untitled Video"; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description != null ? description : ""; }
    public void setDescription(String description) { this.description = description; }

    public String getThumbnailUrl() { return thumbnailUrl != null ? thumbnailUrl : ""; }
    public void setThumbnailUrl(String thumbnailUrl) { this.thumbnailUrl = thumbnailUrl; }

    public String getMasterPlaylistUrl() { return masterPlaylistUrl != null ? masterPlaylistUrl : ""; }
    public void setMasterPlaylistUrl(String masterPlaylistUrl) { this.masterPlaylistUrl = masterPlaylistUrl; }

    public int getDurationSeconds() { return durationSeconds; }
    public void setDurationSeconds(int durationSeconds) { this.durationSeconds = durationSeconds; }

    public int getViewsCount() { return viewsCount; }
    public void setViewsCount(int viewsCount) { this.viewsCount = viewsCount; }

    public int getLikesCount() { return likesCount; }
    public void setLikesCount(int likesCount) { this.likesCount = likesCount; }

    public String getChannelTitle() { return channelTitle != null ? channelTitle : "VD Originals"; }
    public void setChannelTitle(String channelTitle) { this.channelTitle = channelTitle; }
    public String getChannelName() { return getChannelTitle(); }

    public String getChannelAvatar() { return channelAvatar != null ? channelAvatar : ""; }
    public void setChannelAvatar(String channelAvatar) { this.channelAvatar = channelAvatar; }

    public String getCategory() { return category != null ? category : "Cinema"; }
    public void setCategory(String category) { this.category = category; }

    public List<String> getTags() { return tags; }
    public void setTags(List<String> tags) { this.tags = tags; }

    public String getPublishedAt() { return "2026"; }

    public String getDuration() { return getFormattedDuration(); }

    public String getFormattedDuration() {
        if (durationSeconds <= 0) return "00:00";
        int hours = durationSeconds / 3600;
        int minutes = (durationSeconds % 3600) / 60;
        int seconds = durationSeconds % 60;
        if (hours > 0) {
            return String.format(Locale.US, "%d:%02d:%02d", hours, minutes, seconds);
        }
        return String.format(Locale.US, "%02d:%02d", minutes, seconds);
    }

    public String getFormattedViews() {
        if (viewsCount >= 1000000) {
            return String.format(Locale.US, "%.1fM views", viewsCount / 1000000.0);
        } else if (viewsCount >= 1000) {
            return String.format(Locale.US, "%dK views", viewsCount / 1000);
        }
        return viewsCount + " views";
    }

    public String getFullStreamUrl(String baseUrl) {
        if (masterPlaylistUrl == null || masterPlaylistUrl.isEmpty()) return "";
        if (masterPlaylistUrl.startsWith("http://") || masterPlaylistUrl.startsWith("https://")) {
            return masterPlaylistUrl;
        }
        if (baseUrl.endsWith("/") && masterPlaylistUrl.startsWith("/")) {
            return baseUrl.substring(0, baseUrl.length() - 1) + masterPlaylistUrl;
        } else if (!baseUrl.endsWith("/") && !masterPlaylistUrl.startsWith("/")) {
            return baseUrl + "/" + masterPlaylistUrl;
        }
        return baseUrl + masterPlaylistUrl;
    }

    public String getFullThumbnailUrl(String baseUrl) {
        if (thumbnailUrl == null || thumbnailUrl.isEmpty()) return "";
        if (thumbnailUrl.startsWith("http://") || thumbnailUrl.startsWith("https://") || thumbnailUrl.startsWith("data:")) {
            return thumbnailUrl;
        }
        if (baseUrl.endsWith("/") && thumbnailUrl.startsWith("/")) {
            return baseUrl.substring(0, baseUrl.length() - 1) + thumbnailUrl;
        } else if (!baseUrl.endsWith("/") && !thumbnailUrl.startsWith("/")) {
            return baseUrl + "/" + thumbnailUrl;
        }
        return baseUrl + thumbnailUrl;
    }
}
