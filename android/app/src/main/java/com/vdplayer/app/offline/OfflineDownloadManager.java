package com.vdplayer.app.offline;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import com.vdplayer.app.model.Video;
import com.vdplayer.app.network.ApiClient;

import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class OfflineDownloadManager {
    private static final String TAG = "OfflineDownloadManager";
    private static final String VAULT_DIR_NAME = ".vd_secure_vault";
    private static final String EXT_MEDIA = ".vdmedia";
    private static final String EXT_THUMB = ".vdimag";
    private static final String EXT_META = ".vdmeta";

    private static OfflineDownloadManager instance;
    private final Context context;
    private final File vaultDir;
    private final ExecutorService executorService;
    private final Handler mainHandler;

    public interface DownloadListener {
        void onProgress(int progressPercent, long bytesDownloaded, long totalBytes);
        void onComplete(Video video);
        void onError(String errorMessage);
    }

    private OfflineDownloadManager(Context context) {
        this.context = context.getApplicationContext();
        // Secure internal private storage sandbox: /data/user/0/com.vdplayer.app/files/.vd_secure_vault
        // Completely hidden from Phone Gallery, VLC, WhatsApp, Files apps
        this.vaultDir = new File(this.context.getFilesDir(), VAULT_DIR_NAME);
        if (!this.vaultDir.exists()) {
            this.vaultDir.mkdirs();
        }

        // Create .nomedia to prevent any Android media scanner indexing
        File noMediaFile = new File(this.vaultDir, ".nomedia");
        if (!noMediaFile.exists()) {
            try {
                noMediaFile.createNewFile();
            } catch (Exception ignored) {}
        }

        this.executorService = Executors.newFixedThreadPool(2);
        this.mainHandler = new Handler(Looper.getMainLooper());
    }

    public static synchronized OfflineDownloadManager getInstance(Context context) {
        if (instance == null) {
            instance = new OfflineDownloadManager(context);
        }
        return instance;
    }

    public boolean isVideoDownloaded(String videoId) {
        if (videoId == null || videoId.isEmpty()) return false;
        File mediaFile = new File(vaultDir, sanitizeId(videoId) + EXT_MEDIA);
        File metaFile = new File(vaultDir, sanitizeId(videoId) + EXT_META);
        return mediaFile.exists() && mediaFile.length() > 0 && metaFile.exists();
    }

    public File getMediaFile(String videoId) {
        return new File(vaultDir, sanitizeId(videoId) + EXT_MEDIA);
    }

    public File getThumbnailFile(String videoId) {
        return new File(vaultDir, sanitizeId(videoId) + EXT_THUMB);
    }

    public Video getDownloadedVideo(String videoId) {
        File metaFile = new File(vaultDir, sanitizeId(videoId) + EXT_META);
        if (!metaFile.exists()) return null;

        try (FileInputStream fis = new FileInputStream(metaFile)) {
            byte[] data = new byte[(int) metaFile.length()];
            fis.read(data);
            String jsonStr = new String(data, "UTF-8");
            JSONObject json = new JSONObject(jsonStr);

            Video video = new Video();
            video.setId(json.optString("id", videoId));
            video.setTitle(json.optString("title", "Offline Video"));
            video.setDescription(json.optString("description", ""));
            video.setChannelTitle(json.optString("channelTitle", "VD Originals"));
            video.setCategory(json.optString("category", "Offline"));
            video.setDurationSeconds(json.optInt("durationSeconds", 0));
            video.setViewsCount(json.optInt("viewsCount", 0));

            // Set local stream URL
            File mediaFile = getMediaFile(videoId);
            video.setMasterPlaylistUrl(mediaFile.getAbsolutePath());

            // Set local thumbnail path
            File thumbFile = getThumbnailFile(videoId);
            if (thumbFile.exists()) {
                video.setThumbnailUrl(thumbFile.getAbsolutePath());
            }

            return video;
        } catch (Exception e) {
            Log.e(TAG, "Failed to read downloaded meta for " + videoId, e);
            return null;
        }
    }

    public List<Video> getAllDownloadedVideos() {
        List<Video> list = new ArrayList<>();
        File[] files = vaultDir.listFiles();
        if (files == null) return list;

        for (File f : files) {
            if (f.getName().endsWith(EXT_META)) {
                String videoId = f.getName().replace(EXT_META, "");
                Video v = getDownloadedVideo(videoId);
                if (v != null && isVideoDownloaded(videoId)) {
                    list.add(v);
                }
            }
        }
        return list;
    }

    public boolean deleteDownloadedVideo(String videoId) {
        if (videoId == null) return false;
        String sId = sanitizeId(videoId);
        File mediaFile = new File(vaultDir, sId + EXT_MEDIA);
        File thumbFile = new File(vaultDir, sId + EXT_THUMB);
        File metaFile = new File(vaultDir, sId + EXT_META);

        boolean m = !mediaFile.exists() || mediaFile.delete();
        boolean t = !thumbFile.exists() || thumbFile.delete();
        boolean d = !metaFile.exists() || metaFile.delete();
        return m && t && d;
    }

    public String getTotalStorageUsedFormatted() {
        long totalBytes = 0;
        File[] files = vaultDir.listFiles();
        if (files != null) {
            for (File f : files) {
                totalBytes += f.length();
            }
        }

        if (totalBytes >= 1024 * 1024 * 1024) {
            return String.format(Locale.US, "%.2f GB", totalBytes / (1024.0 * 1024.0 * 1024.0));
        } else if (totalBytes >= 1024 * 1024) {
            return String.format(Locale.US, "%.1f MB", totalBytes / (1024.0 * 1024.0));
        } else if (totalBytes >= 1024) {
            return String.format(Locale.US, "%d KB", totalBytes / 1024);
        }
        return totalBytes + " B";
    }

    public void downloadVideo(final Video video, final DownloadListener listener) {
        if (video == null || video.getId().isEmpty()) {
            if (listener != null) listener.onError("Invalid video");
            return;
        }

        final String activeBase = ApiClient.getInstance().getActiveBaseUrl();
        final String streamUrl = video.getFullStreamUrl(activeBase);
        final String thumbUrl = video.getFullThumbnailUrl(activeBase);

        if (streamUrl == null || streamUrl.isEmpty()) {
            if (listener != null) listener.onError("Stream URL not found");
            return;
        }

        executorService.execute(() -> {
            String sId = sanitizeId(video.getId());
            File mediaFile = new File(vaultDir, sId + EXT_MEDIA + ".tmp");
            File thumbFile = new File(vaultDir, sId + EXT_THUMB);
            File metaFile = new File(vaultDir, sId + EXT_META);

            try {
                // 1. Download Video Media Stream
                URL url = new URL(streamUrl);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestProperty("User-Agent", "VDPlayer-Android/1.0");
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(30000);
                conn.connect();

                int responseCode = conn.getResponseCode();
                if (responseCode != HttpURLConnection.HTTP_OK && responseCode != HttpURLConnection.HTTP_PARTIAL) {
                    throw new Exception("HTTP error code: " + responseCode);
                }

                long totalBytes = conn.getContentLengthLong();
                InputStream in = conn.getInputStream();
                OutputStream out = new FileOutputStream(mediaFile);

                byte[] buffer = new byte[64 * 1024]; // 64KB high speed buffer
                long bytesDownloaded = 0;
                int bytesRead;
                int lastReportedPercent = -1;

                while ((bytesRead = in.read(buffer)) != -1) {
                    out.write(buffer, 0, bytesRead);
                    bytesDownloaded += bytesRead;

                    if (totalBytes > 0) {
                        final int percent = (int) ((bytesDownloaded * 100) / totalBytes);
                        if (percent != lastReportedPercent) {
                            lastReportedPercent = percent;
                            final long finalBytes = bytesDownloaded;
                            mainHandler.post(() -> {
                                if (listener != null) {
                                    listener.onProgress(percent, finalBytes, totalBytes);
                                }
                            });
                        }
                    }
                }

                out.flush();
                out.close();
                in.close();
                conn.disconnect();

                // Rename media temp file to final media file
                File finalMediaFile = new File(vaultDir, sId + EXT_MEDIA);
                if (finalMediaFile.exists()) finalMediaFile.delete();
                mediaFile.renameTo(finalMediaFile);

                // 2. Download Thumbnail Image
                if (thumbUrl != null && !thumbUrl.isEmpty()) {
                    try {
                        URL tUrl = new URL(thumbUrl);
                        HttpURLConnection tConn = (HttpURLConnection) tUrl.openConnection();
                        tConn.setConnectTimeout(8000);
                        tConn.connect();
                        if (tConn.getResponseCode() == HttpURLConnection.HTTP_OK) {
                            InputStream tin = tConn.getInputStream();
                            OutputStream tout = new FileOutputStream(thumbFile);
                            byte[] tbuf = new byte[8192];
                            int tRead;
                            while ((tRead = tin.read(tbuf)) != -1) {
                                tout.write(tbuf, 0, tRead);
                            }
                            tout.flush();
                            tout.close();
                            tin.close();
                        }
                        tConn.disconnect();
                    } catch (Exception e) {
                        Log.w(TAG, "Failed downloading thumb for " + video.getId(), e);
                    }
                }

                // 3. Save Metadata JSON
                JSONObject metaJson = new JSONObject();
                metaJson.put("id", video.getId());
                metaJson.put("title", video.getTitle());
                metaJson.put("description", video.getDescription());
                metaJson.put("channelTitle", video.getChannelTitle());
                metaJson.put("category", video.getCategory());
                metaJson.put("durationSeconds", video.getDurationSeconds());
                metaJson.put("viewsCount", video.getViewsCount());
                metaJson.put("fileSizeBytes", finalMediaFile.length());
                metaJson.put("downloadTimestamp", System.currentTimeMillis());

                try (FileOutputStream mOut = new FileOutputStream(metaFile)) {
                    mOut.write(metaJson.toString().getBytes("UTF-8"));
                }

                // Load completed offline Video object
                final Video offlineVideo = getDownloadedVideo(video.getId());
                mainHandler.post(() -> {
                    if (listener != null) {
                        listener.onComplete(offlineVideo != null ? offlineVideo : video);
                    }
                });

            } catch (final Exception e) {
                if (mediaFile.exists()) mediaFile.delete();
                mainHandler.post(() -> {
                    if (listener != null) {
                        listener.onError("Download failed: " + e.getMessage());
                    }
                });
            }
        });
    }

    private String sanitizeId(String id) {
        return id.replaceAll("[^a-zA-Z0-9_-]", "_");
    }
}
