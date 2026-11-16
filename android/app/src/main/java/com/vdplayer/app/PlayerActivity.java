package com.vdplayer.app;

import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.ColorMatrix;
import android.graphics.ColorMatrixColorFilter;
import android.graphics.Paint;
import android.media.audiofx.BassBoost;
import android.media.audiofx.Equalizer;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.TextureView;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.constraintlayout.widget.ConstraintLayout;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.core.widget.NestedScrollView;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackParameters;
import androidx.media3.common.Player;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.ui.AspectRatioFrameLayout;
import androidx.media3.ui.PlayerView;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.vdplayer.app.adapter.VideoGridAdapter;
import com.vdplayer.app.model.Video;
import com.vdplayer.app.network.ApiClient;
import com.vdplayer.app.network.ImageLoader;

import java.util.ArrayList;
import java.util.List;

public class PlayerActivity extends AppCompatActivity {

    public static final String EXTRA_VIDEO = "extra_video";

    private ConstraintLayout rootLayout;
    private FrameLayout playerContainer;
    private PlayerView playerView;
    private View vividOverlay;
    private LinearLayout playerTopBar;
    private ImageView btnBack;
    private TextView playerOverlayTitle;
    private TextView badgeActive24k;
    private TextView badgeActiveDolby;
    private ImageView btnAspectRatio;
    private ImageView btnFullscreenToggle;
    private TextView tvResizeHud;
    private ProgressBar playerLoading;
    private NestedScrollView detailsScrollView;

    private TextView tvDetailTitle;
    private TextView tvDetailMeta;
    private LinearLayout btnToggle24k;
    private ImageView icon24kSparkle;
    private TextView tv24kLabel;
    private LinearLayout btnToggleDolby;
    private ImageView iconDolbyEq;
    private TextView tvDolbyLabel;
    private LinearLayout btnScreenFit;
    private TextView tvScreenFitLabel;
    private LinearLayout btnPlaybackSpeed;
    private TextView tvSpeedLabel;

    private LinearLayout btnActionLike;
    private ImageView ivLikeIcon;
    private LinearLayout btnActionWatchlist;
    private ImageView ivWatchlistIcon;
    private LinearLayout btnActionShare;

    private ImageView ivChannelAvatar;
    private TextView tvChannelName;
    private TextView tvSubscriberCount;
    private Button btnSubscribe;
    private TextView tvDetailDescription;

    private RecyclerView rvRelatedVideos;
    private VideoGridAdapter relatedAdapter;
    private final List<Video> relatedList = new ArrayList<>();

    private ExoPlayer player;
    private Video currentVideo;

    // 24K and Dolby Enhancement State
    private boolean is24kVividEnabled = false;
    private boolean isDolbyAudioEnabled = false;
    private boolean isLiked = false;
    private boolean isWatchlisted = false;
    private boolean isSubscribed = false;

    // Audio effects
    private BassBoost bassBoost;
    private Equalizer equalizer;

    // Playback Speed
    private final float[] speedOptions = {1.0f, 1.25f, 1.5f, 2.0f, 0.75f};
    private int currentSpeedIndex = 0;

    // MX Player Style Resize / Aspect Ratio Modes
    // 0: RESIZE_MODE_FIT (Fit to Screen - full picture visible with pillarbox/letterbox)
    // 3: RESIZE_MODE_FILL (Stretch / 100% Full Screen - no black bars edge-to-edge)
    // 4: RESIZE_MODE_ZOOM (Crop / Zoom to Fill - full screen maintaining aspect ratio)
    // 1: RESIZE_MODE_FIXED_WIDTH (100% Original 1:1)
    private static final int[] RESIZE_MODES = {
            AspectRatioFrameLayout.RESIZE_MODE_FIT,
            AspectRatioFrameLayout.RESIZE_MODE_FILL,
            AspectRatioFrameLayout.RESIZE_MODE_ZOOM,
            AspectRatioFrameLayout.RESIZE_MODE_FIXED_WIDTH
    };
    private static final String[] RESIZE_MODE_LABELS = {
            "Fit to Screen",
            "Stretch (100% Full)",
            "Crop to Fill (Zoom)",
            "100% Original"
    };
    private static final String[] RESIZE_MODE_ICONS = {
            "📐 Fit to Screen",
            "↔️ Stretch (100% Full Screen)",
            "🔍 Crop to Fill (100% Zoom)",
            "1️⃣ 100% Original (1:1)"
    };
    private int currentResizeModeIndex = 0;

    // 10-Second Auto-Hide System for Top Bar & Details
    private final Handler autoHideHandler = new Handler(Looper.getMainLooper());
    private final Runnable autoHideRunnable = this::hideTopOverlay;
    private static final long AUTO_HIDE_DELAY_MS = 10000; // Exactly 10 seconds!

    // HUD Badge Handler
    private final Handler hudHandler = new Handler(Looper.getMainLooper());
    private final Runnable hideHudRunnable = () -> {
        if (tvResizeHud != null) {
            tvResizeHud.animate().alpha(0f).setDuration(250).withEndAction(() -> {
                tvResizeHud.setVisibility(View.GONE);
            }).start();
        }
    };

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_player);

        // Keep screen on while playing video
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        bindViews();
        setupListeners();
        setupRelatedRecyclerView();

        currentVideo = (Video) getIntent().getSerializableExtra(EXTRA_VIDEO);
        if (currentVideo == null) {
            Toast.makeText(this, "No video specified to play", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        initializeExoPlayer();
        loadVideoData(currentVideo);
        fetchRelatedVideos();
    }

    private void bindViews() {
        rootLayout = findViewById(R.id.player_root_layout);
        playerContainer = findViewById(R.id.player_container);
        playerView = findViewById(R.id.player_view);
        vividOverlay = findViewById(R.id.vivid_overlay);
        playerTopBar = findViewById(R.id.player_top_bar);
        btnBack = findViewById(R.id.btn_back);
        playerOverlayTitle = findViewById(R.id.player_overlay_title);
        badgeActive24k = findViewById(R.id.badge_active_24k);
        badgeActiveDolby = findViewById(R.id.badge_active_dolby);
        btnAspectRatio = findViewById(R.id.btn_aspect_ratio);
        btnFullscreenToggle = findViewById(R.id.btn_fullscreen_toggle);
        tvResizeHud = findViewById(R.id.tv_resize_hud);
        playerLoading = findViewById(R.id.player_loading);
        detailsScrollView = findViewById(R.id.details_scroll_view);

        tvDetailTitle = findViewById(R.id.tv_detail_title);
        tvDetailMeta = findViewById(R.id.tv_detail_meta);
        btnToggle24k = findViewById(R.id.btn_toggle_24k);
        icon24kSparkle = findViewById(R.id.icon_24k_sparkle);
        tv24kLabel = findViewById(R.id.tv_24k_label);
        btnToggleDolby = findViewById(R.id.btn_toggle_dolby);
        iconDolbyEq = findViewById(R.id.icon_dolby_eq);
        tvDolbyLabel = findViewById(R.id.tv_dolby_label);
        btnScreenFit = findViewById(R.id.btn_screen_fit);
        tvScreenFitLabel = findViewById(R.id.tv_screen_fit_label);
        btnPlaybackSpeed = findViewById(R.id.btn_playback_speed);
        tvSpeedLabel = findViewById(R.id.tv_speed_label);

        btnActionLike = findViewById(R.id.btn_action_like);
        ivLikeIcon = findViewById(R.id.iv_like_icon);
        btnActionWatchlist = findViewById(R.id.btn_action_watchlist);
        ivWatchlistIcon = findViewById(R.id.iv_watchlist_icon);
        btnActionShare = findViewById(R.id.btn_action_share);

        ivChannelAvatar = findViewById(R.id.iv_channel_avatar);
        tvChannelName = findViewById(R.id.tv_channel_name);
        tvSubscriberCount = findViewById(R.id.tv_subscriber_count);
        btnSubscribe = findViewById(R.id.btn_subscribe);
        tvDetailDescription = findViewById(R.id.tv_detail_description);

        rvRelatedVideos = findViewById(R.id.rv_related_videos);
    }

    private void setupListeners() {
        btnBack.setOnClickListener(v -> {
            if (getResources().getConfiguration().orientation == Configuration.ORIENTATION_LANDSCAPE) {
                // In landscape fullscreen, pressing back restores portrait first
                setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
            } else {
                finish();
            }
        });

        // MX Player Style Aspect Ratio / Screen Fit Cycle
        if (btnAspectRatio != null) {
            btnAspectRatio.setOnClickListener(v -> cycleResizeMode());
        }
        if (btnScreenFit != null) {
            btnScreenFit.setOnClickListener(v -> cycleResizeMode());
        }

        // Fullscreen Landscape / Portrait Toggle
        if (btnFullscreenToggle != null) {
            btnFullscreenToggle.setOnClickListener(v -> toggleFullscreenOrientation());
        }

        // 24K Cinema Vivid Toggle
        btnToggle24k.setOnClickListener(v -> toggle24kVividMode());

        // Dolby Audio Bass EQ Toggle
        btnToggleDolby.setOnClickListener(v -> toggleDolbyAudio());

        // Speed Toggle
        btnPlaybackSpeed.setOnClickListener(v -> cyclePlaybackSpeed());

        // Like Button
        btnActionLike.setOnClickListener(v -> {
            isLiked = !isLiked;
            if (isLiked) {
                ivLikeIcon.setColorFilter(Color.parseColor("#E50914"));
                Toast.makeText(this, "Added to Liked Videos", Toast.LENGTH_SHORT).show();
            } else {
                ivLikeIcon.setColorFilter(Color.parseColor("#FFFFFF"));
            }
        });

        // Watchlist Button
        btnActionWatchlist.setOnClickListener(v -> {
            isWatchlisted = !isWatchlisted;
            if (isWatchlisted) {
                ivWatchlistIcon.setColorFilter(Color.parseColor("#FACC15"));
                Toast.makeText(this, "Saved to My List", Toast.LENGTH_SHORT).show();
            } else {
                ivWatchlistIcon.setColorFilter(Color.parseColor("#FFFFFF"));
            }
        });

        // Share Button
        btnActionShare.setOnClickListener(v -> shareCurrentVideo());

        // Subscribe Button
        btnSubscribe.setOnClickListener(v -> {
            isSubscribed = !isSubscribed;
            if (isSubscribed) {
                btnSubscribe.setText("Subscribed ✓");
                btnSubscribe.setBackgroundColor(Color.parseColor("#374151"));
                Toast.makeText(this, "Subscribed to " + currentVideo.getChannelName(), Toast.LENGTH_SHORT).show();
            } else {
                btnSubscribe.setText("Subscribe");
                btnSubscribe.setBackgroundColor(Color.parseColor("#E50914"));
            }
        });

        // Tap screen to show/hide top bar & reset 10-second timer
        playerView.setOnClickListener(v -> toggleTopOverlay());
        playerContainer.setOnClickListener(v -> toggleTopOverlay());
    }

    private void setupRelatedRecyclerView() {
        relatedAdapter = new VideoGridAdapter(this, video -> {
            loadVideoData(video);
            playVideo(video);
            detailsScrollView.smoothScrollTo(0, 0);
        });
        rvRelatedVideos.setLayoutManager(new LinearLayoutManager(this));
        rvRelatedVideos.setAdapter(relatedAdapter);
    }

    private void initializeExoPlayer() {
        DefaultHttpDataSource.Factory httpDataSourceFactory = new DefaultHttpDataSource.Factory()
                .setUserAgent("VDPlayer-Android/1.0")
                .setConnectTimeoutMs(15000)
                .setReadTimeoutMs(25000)
                .setAllowCrossProtocolRedirects(true);

        DefaultMediaSourceFactory mediaSourceFactory = new DefaultMediaSourceFactory(this)
                .setDataSourceFactory(httpDataSourceFactory);

        player = new ExoPlayer.Builder(this)
                .setMediaSourceFactory(mediaSourceFactory)
                .build();

        playerView.setPlayer(player);
        playerView.setResizeMode(RESIZE_MODES[currentResizeModeIndex]); // Default Fit to Screen

        // Configure 10-Second Auto-Hide Timeout on Controller
        playerView.setControllerShowTimeoutMs((int) AUTO_HIDE_DELAY_MS);
        playerView.setControllerVisibilityListener(new PlayerView.ControllerVisibilityListener() {
            @Override
            public void onVisibilityChanged(int visibility) {
                if (visibility == View.VISIBLE) {
                    showTopOverlay();
                } else {
                    hideTopOverlay();
                }
            }
        });

        player.addListener(new Player.Listener() {
            @Override
            public void onPlaybackStateChanged(int playbackState) {
                if (playbackState == Player.STATE_BUFFERING) {
                    playerLoading.setVisibility(View.VISIBLE);
                } else {
                    playerLoading.setVisibility(View.GONE);
                }

                if (playbackState == Player.STATE_READY) {
                    if (isDolbyAudioEnabled && bassBoost == null) {
                        applyDolbyAudioEffects(true);
                    }
                    // Start 10-second auto-hide timer once playback is active
                    scheduleAutoHide();
                }
            }

            @Override
            public void onPlayerError(@NonNull androidx.media3.common.PlaybackException error) {
                playerLoading.setVisibility(View.GONE);
                Toast.makeText(PlayerActivity.this, "Stream Error: " + error.getMessage(), Toast.LENGTH_LONG).show();
            }
        });
    }

    private void loadVideoData(Video video) {
        currentVideo = video;

        playerOverlayTitle.setText(video.getTitle());
        tvDetailTitle.setText(video.getTitle());
        tvDetailMeta.setText(video.getFormattedViews() + " • " + video.getPublishedAt() + " • " + video.getDuration());
        tvChannelName.setText(video.getChannelName());
        tvDetailDescription.setText(video.getDescription() != null && !video.getDescription().isEmpty()
                ? video.getDescription()
                : "Experience high bitrate cinema-grade master quality streaming on VD Player. Encoded with adaptive byte slices and multi-bucket zero-latency routing.");

        // Channel avatar
        String activeBase = ApiClient.getInstance().getActiveBaseUrl();
        if (video.getThumbnailUrl() != null && !video.getThumbnailUrl().isEmpty()) {
            ImageLoader.getInstance().load(video.getFullThumbnailUrl(activeBase), ivChannelAvatar, 8);
        }

        playVideo(video);
    }

    private void playVideo(Video video) {
        String activeBase = ApiClient.getInstance().getActiveBaseUrl();
        String streamUrl = video.getFullStreamUrl(activeBase);
        if (streamUrl == null || streamUrl.isEmpty()) {
            Toast.makeText(this, "Invalid video stream URL", Toast.LENGTH_SHORT).show();
            return;
        }

        MediaItem mediaItem = MediaItem.fromUri(Uri.parse(streamUrl));
        player.setMediaItem(mediaItem);
        player.prepare();
        player.play();

        scheduleAutoHide();
    }

    private void fetchRelatedVideos() {
        ApiClient.getInstance().fetchVideos(new ApiClient.ApiCallback<List<Video>>() {
            @Override
            public void onSuccess(List<Video> videos) {
                runOnUiThread(() -> {
                    relatedList.clear();
                    for (Video v : videos) {
                        if (currentVideo == null || !v.getId().equals(currentVideo.getId())) {
                            relatedList.add(v);
                        }
                    }
                    relatedAdapter.setVideos(relatedList);
                });
            }

            @Override
            public void onError(String errorMessage) {
                // Silently handle
            }
        });
    }

    /**
     * Cycles through MX Player style Resize Modes:
     * 1. Fit to Screen
     * 2. Stretch (100% Full Screen - no black bars)
     * 3. Crop to Fill (100% Zoom)
     * 4. 100% Original
     */
    private void cycleResizeMode() {
        currentResizeModeIndex = (currentResizeModeIndex + 1) % RESIZE_MODES.length;
        int mode = RESIZE_MODES[currentResizeModeIndex];
        String label = RESIZE_MODE_LABELS[currentResizeModeIndex];
        String hudText = RESIZE_MODE_ICONS[currentResizeModeIndex];

        playerView.setResizeMode(mode);
        if (tvScreenFitLabel != null) {
            tvScreenFitLabel.setText(label);
        }

        showResizeHud(hudText);
        Toast.makeText(this, "Screen Fit: " + label, Toast.LENGTH_SHORT).show();

        // Reset 10-second timer on interaction
        scheduleAutoHide();
    }

    private void showResizeHud(String text) {
        if (tvResizeHud == null) return;
        tvResizeHud.setText(text);
        tvResizeHud.setAlpha(0f);
        tvResizeHud.setVisibility(View.VISIBLE);
        tvResizeHud.animate().alpha(1f).setDuration(150).start();

        hudHandler.removeCallbacks(hideHudRunnable);
        hudHandler.postDelayed(hideHudRunnable, 1600);
    }

    /**
     * Toggles Fullscreen between Landscape and Portrait orientation.
     */
    private void toggleFullscreenOrientation() {
        int currentOrientation = getResources().getConfiguration().orientation;
        if (currentOrientation == Configuration.ORIENTATION_LANDSCAPE) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        } else {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
        }
    }

    /**
     * 10-Second Auto-Hide Management
     */
    private void scheduleAutoHide() {
        autoHideHandler.removeCallbacks(autoHideRunnable);
        autoHideHandler.postDelayed(autoHideRunnable, AUTO_HIDE_DELAY_MS);
    }

    private void cancelAutoHide() {
        autoHideHandler.removeCallbacks(autoHideRunnable);
    }

    private void showTopOverlay() {
        if (playerTopBar == null) return;
        playerTopBar.animate().cancel();
        playerTopBar.setAlpha(0f);
        playerTopBar.setVisibility(View.VISIBLE);
        playerTopBar.animate().alpha(1f).setDuration(250).start();

        // Automatically start the 10-second auto-hide countdown
        scheduleAutoHide();
    }

    private void hideTopOverlay() {
        if (playerTopBar == null || playerTopBar.getVisibility() != View.VISIBLE) return;
        playerTopBar.animate().cancel();
        playerTopBar.animate().alpha(0f).setDuration(350).withEndAction(() -> {
            playerTopBar.setVisibility(View.GONE);
        }).start();
    }

    private void toggleTopOverlay() {
        if (playerTopBar == null) return;
        if (playerTopBar.getVisibility() == View.VISIBLE) {
            hideTopOverlay();
            cancelAutoHide();
        } else {
            showTopOverlay();
        }
    }

    /**
     * Toggles the "24K Cinema Vivid" color grade enhancement.
     */
    private void toggle24kVividMode() {
        is24kVividEnabled = !is24kVividEnabled;

        if (is24kVividEnabled) {
            btnToggle24k.setBackgroundResource(R.drawable.bg_pill_toggle_on_24k);
            tv24kLabel.setTextColor(Color.parseColor("#000000"));
            icon24kSparkle.setColorFilter(Color.parseColor("#000000"));
            badgeActive24k.setVisibility(View.VISIBLE);

            applyVividFilter(true);
            Toast.makeText(this, "✨ 24K Cinema Vivid Mode: ON (Master Grade Color)", Toast.LENGTH_SHORT).show();
        } else {
            btnToggle24k.setBackgroundResource(R.drawable.bg_pill_toggle_off);
            tv24kLabel.setTextColor(Color.parseColor("#9CA3AF"));
            icon24kSparkle.setColorFilter(Color.parseColor("#9CA3AF"));
            badgeActive24k.setVisibility(View.GONE);

            applyVividFilter(false);
            Toast.makeText(this, "24K Vivid Mode: OFF (Standard Natural Color)", Toast.LENGTH_SHORT).show();
        }
        scheduleAutoHide();
    }

    private void applyVividFilter(boolean enable) {
        try {
            View surfaceView = playerView.getVideoSurfaceView();
            if (surfaceView instanceof TextureView) {
                TextureView textureView = (TextureView) surfaceView;
                if (enable) {
                    ColorMatrix satMatrix = new ColorMatrix();
                    satMatrix.setSaturation(1.30f); // +30% Vivid Saturation

                    float scale = 1.15f; // +15% Contrast
                    float translate = (-0.5f * scale + 0.5f) * 255.0f;
                    ColorMatrix contrastMatrix = new ColorMatrix(new float[]{
                            scale, 0, 0, 0, translate,
                            0, scale, 0, 0, translate,
                            0, 0, scale, 0, translate,
                            0, 0, 0, 1, 0
                    });

                    ColorMatrix combined = new ColorMatrix();
                    combined.setConcat(contrastMatrix, satMatrix);

                    Paint paint = new Paint();
                    paint.setColorFilter(new ColorMatrixColorFilter(combined));
                    textureView.setLayerType(View.LAYER_TYPE_HARDWARE, paint);
                } else {
                    textureView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
                }
            } else {
                vividOverlay.setVisibility(enable ? View.VISIBLE : View.GONE);
            }
        } catch (Throwable t) {
            vividOverlay.setVisibility(enable ? View.VISIBLE : View.GONE);
        }
    }

    /**
     * Toggles "Dolby 3D Audio & Bass Boost" hardware audio effects.
     */
    private void toggleDolbyAudio() {
        isDolbyAudioEnabled = !isDolbyAudioEnabled;

        if (isDolbyAudioEnabled) {
            btnToggleDolby.setBackgroundResource(R.drawable.bg_pill_toggle_on_dolby);
            tvDolbyLabel.setTextColor(Color.parseColor("#FFFFFF"));
            iconDolbyEq.setColorFilter(Color.parseColor("#FFFFFF"));
            badgeActiveDolby.setVisibility(View.VISIBLE);

            applyDolbyAudioEffects(true);
            Toast.makeText(this, "🎧 Dolby 3D Audio & Sub-Bass Boost: ON", Toast.LENGTH_SHORT).show();
        } else {
            btnToggleDolby.setBackgroundResource(R.drawable.bg_pill_toggle_off);
            tvDolbyLabel.setTextColor(Color.parseColor("#9CA3AF"));
            iconDolbyEq.setColorFilter(Color.parseColor("#9CA3AF"));
            badgeActiveDolby.setVisibility(View.GONE);

            applyDolbyAudioEffects(false);
            Toast.makeText(this, "Dolby Audio: OFF (Flat EQ)", Toast.LENGTH_SHORT).show();
        }
        scheduleAutoHide();
    }

    private void applyDolbyAudioEffects(boolean enable) {
        try {
            if (player == null) return;
            int audioSessionId = player.getAudioSessionId();
            if (audioSessionId == C.AUDIO_SESSION_ID_UNSET || audioSessionId == 0) {
                return;
            }

            if (enable) {
                if (bassBoost == null) {
                    bassBoost = new BassBoost(0, audioSessionId);
                }
                if (bassBoost.getStrengthSupported()) {
                    bassBoost.setStrength((short) 1000);
                }
                bassBoost.setEnabled(true);

                if (equalizer == null) {
                    equalizer = new Equalizer(0, audioSessionId);
                }
                equalizer.setEnabled(true);
                short bands = equalizer.getNumberOfBands();
                if (bands > 0) {
                    short minLevel = equalizer.getBandLevelRange()[0];
                    short maxLevel = equalizer.getBandLevelRange()[1];
                    short bassGain = (short) Math.min(maxLevel, 800);
                    short trebleGain = (short) Math.min(maxLevel, 400);

                    equalizer.setBandLevel((short) 0, bassGain);
                    if (bands > 1) {
                        equalizer.setBandLevel((short) (bands - 1), trebleGain);
                    }
                }
            } else {
                if (bassBoost != null) {
                    bassBoost.setEnabled(false);
                }
                if (equalizer != null) {
                    equalizer.setEnabled(false);
                }
            }
        } catch (Throwable t) {
            // Ignored
        }
    }

    private void cyclePlaybackSpeed() {
        currentSpeedIndex = (currentSpeedIndex + 1) % speedOptions.length;
        float speed = speedOptions[currentSpeedIndex];

        if (player != null) {
            player.setPlaybackParameters(new PlaybackParameters(speed));
        }

        tvSpeedLabel.setText("⚡ " + speed + "x Speed");
        Toast.makeText(this, "Playback speed: " + speed + "x", Toast.LENGTH_SHORT).show();
        scheduleAutoHide();
    }

    private void shareCurrentVideo() {
        if (currentVideo == null) return;
        String shareText = "Watch \"" + currentVideo.getTitle() + "\" on VD Player!\n"
                + "https://app.wavemusic.dpdns.org";

        Intent sendIntent = new Intent(Intent.ACTION_SEND);
        sendIntent.putExtra(Intent.EXTRA_TEXT, shareText);
        sendIntent.setType("text/plain");

        Intent shareIntent = Intent.createChooser(sendIntent, "Share Video via");
        startActivity(shareIntent);
    }

    @Override
    public void onConfigurationChanged(@NonNull Configuration newConfig) {
        super.onConfigurationChanged(newConfig);

        if (newConfig.orientation == Configuration.ORIENTATION_LANDSCAPE) {
            enterFullscreenMode();
        } else {
            exitFullscreenMode();
        }
    }

    private void enterFullscreenMode() {
        detailsScrollView.setVisibility(View.GONE);
        ConstraintLayout.LayoutParams params = (ConstraintLayout.LayoutParams) playerContainer.getLayoutParams();
        params.height = ViewGroup.LayoutParams.MATCH_PARENT;
        params.dimensionRatio = null;
        playerContainer.setLayoutParams(params);

        if (btnFullscreenToggle != null) {
            btnFullscreenToggle.setImageResource(R.drawable.ic_fullscreen_exit);
        }

        // Hide system bars completely (Immersive Sticky)
        WindowInsetsControllerCompat insetsController = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (insetsController != null) {
            insetsController.hide(WindowInsetsCompat.Type.systemBars());
            insetsController.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        }

        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        );

        // Schedule auto-hide of top title bar in 10 seconds!
        showTopOverlay();
    }

    private void exitFullscreenMode() {
        detailsScrollView.setVisibility(View.VISIBLE);
        ConstraintLayout.LayoutParams params = (ConstraintLayout.LayoutParams) playerContainer.getLayoutParams();
        params.height = 0;
        params.dimensionRatio = "16:9";
        playerContainer.setLayoutParams(params);

        if (btnFullscreenToggle != null) {
            btnFullscreenToggle.setImageResource(R.drawable.ic_fullscreen);
        }

        WindowInsetsControllerCompat insetsController = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (insetsController != null) {
            insetsController.show(WindowInsetsCompat.Type.systemBars());
        }

        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);

        showTopOverlay();
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (player != null) {
            player.pause();
        }
        cancelAutoHide();
    }

    @Override
    protected void onStop() {
        super.onStop();
        if (player != null) {
            player.pause();
        }
        cancelAutoHide();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        cancelAutoHide();
        if (player != null) {
            player.release();
            player = null;
        }

        if (bassBoost != null) {
            bassBoost.release();
            bassBoost = null;
        }
        if (equalizer != null) {
            equalizer.release();
            equalizer = null;
        }
    }
}
