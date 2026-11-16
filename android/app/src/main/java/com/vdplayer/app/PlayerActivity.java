package com.vdplayer.app;

import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.ColorMatrix;
import android.graphics.ColorMatrixColorFilter;
import android.graphics.Paint;
import android.media.audiofx.BassBoost;
import android.media.audiofx.Equalizer;
import android.net.Uri;
import android.os.Bundle;
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
import androidx.core.widget.NestedScrollView;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackParameters;
import androidx.media3.common.Player;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
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
        btnBack.setOnClickListener(v -> finish());

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
    }

    private void setupRelatedRecyclerView() {
        relatedAdapter = new VideoGridAdapter(this, video -> {
            // Switch video in player smoothly
            loadVideoData(video);
            playVideo(video);
            // Scroll to top of details
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

        player.addListener(new Player.Listener() {
            @Override
            public void onPlaybackStateChanged(int playbackState) {
                if (playbackState == Player.STATE_BUFFERING) {
                    playerLoading.setVisibility(View.VISIBLE);
                } else {
                    playerLoading.setVisibility(View.GONE);
                }

                if (playbackState == Player.STATE_READY) {
                    // Try to attach audio effects once player is initialized and active
                    if (isDolbyAudioEnabled && bassBoost == null) {
                        applyDolbyAudioEffects(true);
                    }
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
    }

    private void fetchRelatedVideos() {
        ApiClient.getInstance().fetchVideos(new ApiClient.ApiCallback<List<Video>>() {
            @Override
            public void onSuccess(List<Video> videos) {
                runOnUiThread(() -> {
                    relatedList.clear();
                    for (Video v : videos) {
                        // Filter out currently playing video
                        if (currentVideo == null || !v.getId().equals(currentVideo.getId())) {
                            relatedList.add(v);
                        }
                    }
                    relatedAdapter.setVideos(relatedList);
                });
            }

            @Override
            public void onError(String errorMessage) {
                // Silently handle related fetch fail
            }
        });
    }

    /**
     * Toggles the "24K Cinema Vivid" color grade enhancement.
     * Uses ColorMatrix hardware filter on the TextureView surface for vivid contrast & punchy color.
     */
    private void toggle24kVividMode() {
        is24kVividEnabled = !is24kVividEnabled;

        if (is24kVividEnabled) {
            btnToggle24k.setBackgroundResource(R.drawable.bg_pill_toggle_on_24k);
            tv24kLabel.setTextColor(Color.parseColor("#000000"));
            icon24kSparkle.setColorFilter(Color.parseColor("#000000"));
            badgeActive24k.setVisibility(View.VISIBLE);

            // Apply 24K Vivid Grade: Boost Saturation (+30%) and Contrast (+15%)
            applyVividFilter(true);
            Toast.makeText(this, "✨ 24K Cinema Vivid Mode: ON (Master Grade Color)", Toast.LENGTH_SHORT).show();
        } else {
            btnToggle24k.setBackgroundResource(R.drawable.bg_pill_toggle_off);
            tv24kLabel.setTextColor(Color.parseColor("#9CA3AF"));
            icon24kSparkle.setColorFilter(Color.parseColor("#9CA3AF"));
            badgeActive24k.setVisibility(View.GONE);

            // Reset video surface filter
            applyVividFilter(false);
            Toast.makeText(this, "24K Vivid Mode: OFF (Standard Natural Color)", Toast.LENGTH_SHORT).show();
        }
    }

    private void applyVividFilter(boolean enable) {
        try {
            View surfaceView = playerView.getVideoSurfaceView();
            if (surfaceView instanceof TextureView) {
                TextureView textureView = (TextureView) surfaceView;
                if (enable) {
                    ColorMatrix satMatrix = new ColorMatrix();
                    satMatrix.setSaturation(1.30f); // +30% Vivid Saturation

                    // Contrast boost (+15%)
                    float scale = 1.15f;
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
                // Fallback subtle overlay
                vividOverlay.setVisibility(enable ? View.VISIBLE : View.GONE);
            }
        } catch (Throwable t) {
            // Graceful fallback
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
    }

    private void applyDolbyAudioEffects(boolean enable) {
        try {
            if (player == null) return;
            int audioSessionId = player.getAudioSessionId();
            if (audioSessionId == C.AUDIO_SESSION_ID_UNSET || audioSessionId == 0) {
                return;
            }

            if (enable) {
                // Initialize BassBoost
                if (bassBoost == null) {
                    bassBoost = new BassBoost(0, audioSessionId);
                }
                if (bassBoost.getStrengthSupported()) {
                    bassBoost.setStrength((short) 1000); // Maximum deep cinematic sub-bass
                }
                bassBoost.setEnabled(true);

                // Initialize Equalizer for Dolby Soundstage curve
                if (equalizer == null) {
                    equalizer = new Equalizer(0, audioSessionId);
                }
                equalizer.setEnabled(true);
                short bands = equalizer.getNumberOfBands();
                if (bands > 0) {
                    // Boost deep bass (band 0) and high clarity frequencies (top band)
                    short minLevel = equalizer.getBandLevelRange()[0];
                    short maxLevel = equalizer.getBandLevelRange()[1];
                    short bassGain = (short) Math.min(maxLevel, 800); // +8dB bass
                    short trebleGain = (short) Math.min(maxLevel, 400); // +4dB treble

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
            // AudioFx may not be supported on all emulator profiles
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

        // Adjust layout for landscape (true fullscreen cinema mode) vs portrait
        if (newConfig.orientation == Configuration.ORIENTATION_LANDSCAPE) {
            // Hide details, make player match_parent
            detailsScrollView.setVisibility(View.GONE);
            ConstraintLayout.LayoutParams params = (ConstraintLayout.LayoutParams) playerContainer.getLayoutParams();
            params.height = ViewGroup.LayoutParams.MATCH_PARENT;
            params.dimensionRatio = null;
            playerContainer.setLayoutParams(params);

            // Fullscreen system bars hide
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            );
        } else {
            // Restore portrait
            detailsScrollView.setVisibility(View.VISIBLE);
            ConstraintLayout.LayoutParams params = (ConstraintLayout.LayoutParams) playerContainer.getLayoutParams();
            params.height = 0;
            params.dimensionRatio = "16:9";
            playerContainer.setLayoutParams(params);

            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (player != null) {
            player.pause();
        }
    }

    @Override
    protected void onStop() {
        super.onStop();
        if (player != null) {
            player.pause();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (player != null) {
            player.release();
            player = null;
        }

        // Release audio effects
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
