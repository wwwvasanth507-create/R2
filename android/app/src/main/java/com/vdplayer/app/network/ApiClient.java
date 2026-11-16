package com.vdplayer.app.network;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import com.vdplayer.app.model.Video;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

public class ApiClient {
    private static final String TAG = "ApiClient";
    
    // Primary API server & fallback domains
    public static final String PRIMARY_API_BASE = "https://api.wavemusic.dpdns.org";
    public static final String FALLBACK_WEB_BASE = "https://app.wavemusic.dpdns.org";
    public static final String LOCAL_EMULATOR_BASE = "http://10.0.2.2:4000";

    private static ApiClient instance;
    private final OkHttpClient httpClient;
    private final Handler mainHandler;
    private String activeBaseUrl = PRIMARY_API_BASE;

    private ApiClient() {
        this.httpClient = new OkHttpClient.Builder()
                .connectTimeout(8, TimeUnit.SECONDS)
                .readTimeout(15, TimeUnit.SECONDS)
                .writeTimeout(15, TimeUnit.SECONDS)
                .retryOnConnectionFailure(true)
                .build();
        this.mainHandler = new Handler(Looper.getMainLooper());
    }

    public static synchronized ApiClient getInstance() {
        if (instance == null) {
            instance = new ApiClient();
        }
        return instance;
    }

    public String getActiveBaseUrl() {
        return activeBaseUrl;
    }

    public void setActiveBaseUrl(String url) {
        this.activeBaseUrl = url;
    }

    public interface ApiCallback<T> {
        void onSuccess(T result);
        void onError(String errorMessage);
    }

    /**
     * Fetches live video feed from the server with auto-fallback.
     */
    public void fetchVideos(final ApiCallback<List<Video>> callback) {
        fetchFromUrl(activeBaseUrl + "/api/videos", new ApiCallback<List<Video>>() {
            @Override
            public void onSuccess(List<Video> result) {
                callback.onSuccess(result);
            }

            @Override
            public void onError(String errorMessage) {
                Log.w(TAG, "Primary API error (" + activeBaseUrl + "): " + errorMessage + ". Trying fallback...");
                String fallbackUrl = activeBaseUrl.equals(PRIMARY_API_BASE) ? FALLBACK_WEB_BASE : PRIMARY_API_BASE;
                fetchFromUrl(fallbackUrl + "/api/youtube/videos", new ApiCallback<List<Video>>() {
                    @Override
                    public void onSuccess(List<Video> fallbackResult) {
                        activeBaseUrl = fallbackUrl;
                        callback.onSuccess(fallbackResult);
                    }

                    @Override
                    public void onError(String fallbackError) {
                        // Last resort local emulator check
                        fetchFromUrl(LOCAL_EMULATOR_BASE + "/api/videos", new ApiCallback<List<Video>>() {
                            @Override
                            public void onSuccess(List<Video> localResult) {
                                activeBaseUrl = LOCAL_EMULATOR_BASE;
                                callback.onSuccess(localResult);
                            }

                            @Override
                            public void onError(String localError) {
                                callback.onError(errorMessage);
                            }
                        });
                    }
                });
            }
        });
    }

    private void fetchFromUrl(String fullUrl, final ApiCallback<List<Video>> callback) {
        Request request = new Request.Builder()
                .url(fullUrl)
                .header("Accept", "application/json")
                .header("User-Agent", "VDPlayer-Android/1.0")
                .build();

        httpClient.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                mainHandler.post(() -> callback.onError("Network error: " + e.getMessage()));
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                if (!response.isSuccessful()) {
                    mainHandler.post(() -> callback.onError("Server returned code " + response.code()));
                    return;
                }

                String jsonBody = response.body() != null ? response.body().string() : "";
                try {
                    List<Video> videos = parseVideosJson(jsonBody);
                    mainHandler.post(() -> callback.onSuccess(videos));
                } catch (Exception e) {
                    mainHandler.post(() -> callback.onError("JSON parse error: " + e.getMessage()));
                }
            }
        });
    }

    public List<Video> parseVideosJson(String json) throws Exception {
        List<Video> list = new ArrayList<>();
        JSONArray array = new JSONArray(json);
        for (int i = 0; i < array.length(); i++) {
            JSONObject obj = array.getJSONObject(i);
            Video video = new Video();
            video.setId(obj.optString("id"));
            video.setTitle(obj.optString("title", "Untitled Video"));
            video.setDescription(obj.optString("description", ""));
            video.setThumbnailUrl(obj.optString("thumbnailUrl", ""));
            video.setMasterPlaylistUrl(obj.optString("masterPlaylistUrl", ""));
            video.setDurationSeconds(obj.optInt("durationSeconds", 0));
            video.setViewsCount(obj.optInt("viewsCount", 0));
            video.setLikesCount(obj.optInt("likesCount", 0));

            // Parse nested channel object if present
            if (obj.has("channel") && !obj.isNull("channel")) {
                JSONObject chObj = obj.getJSONObject("channel");
                video.setChannelTitle(chObj.optString("title", "VASANTH V"));
                video.setChannelAvatar(chObj.optString("avatarUrl", ""));
            } else {
                video.setChannelTitle(obj.optString("channel", "VASANTH V"));
            }

            // Category & tags
            String cat = obj.optString("category", "Cinema");
            if (obj.has("tags")) {
                JSONArray tagsArr = obj.getJSONArray("tags");
                List<String> tagsList = new ArrayList<>();
                for (int t = 0; t < tagsArr.length(); t++) {
                    tagsList.add(tagsArr.getString(t));
                }
                video.setTags(tagsList);
                if (cat.isEmpty() && !tagsList.isEmpty()) {
                    cat = tagsList.get(0);
                }
            }
            video.setCategory(cat.isEmpty() ? "Cinema" : cat);

            list.add(video);
        }
        return list;
    }
}
