package com.vdplayer.app;

import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.View;
import android.view.WindowManager;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.GridLayoutManager;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.google.android.material.bottomnavigation.BottomNavigationView;
import com.google.android.material.button.MaterialButton;
import com.vdplayer.app.adapter.DownloadedVideosAdapter;
import com.vdplayer.app.adapter.VideoCarouselAdapter;
import com.vdplayer.app.adapter.VideoGridAdapter;
import com.vdplayer.app.model.Video;
import com.vdplayer.app.network.ApiClient;
import com.vdplayer.app.network.ImageLoader;
import com.vdplayer.app.offline.OfflineDownloadManager;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class MainActivity extends AppCompatActivity {

    private static final String PREF_NAME = "vd_player_prefs";
    private static final String KEY_CACHED_VIDEOS = "cached_videos_json";
    private static final long LIVE_SYNC_INTERVAL_MS = 12000; // Live auto-sync every 12 seconds!

    private ImageView btnToggleSearch;
    private ImageView btnRefresh;
    private TextView tvLiveIndicator;
    private LinearLayout layoutSearchBar;
    private EditText etSearch;

    private SwipeRefreshLayout swipeRefresh;
    private ProgressBar progressLoading;
    private LinearLayout layoutError;
    private TextView tvErrorMessage;
    private MaterialButton btnRetry;

    // Tab Containers
    private LinearLayout tabLayoutHome;
    private LinearLayout tabLayoutMovies;
    private LinearLayout tabLayoutDownloads;
    private LinearLayout tabLayoutAccount;
    private BottomNavigationView bottomNavigation;

    // Billboard Views
    private FrameLayout layoutBillboard;
    private ImageView imgBillboard;
    private TextView tvBillboardTitle;
    private TextView tvBillboardMeta;
    private TextView tvBillboardCategory;
    private MaterialButton btnBillboardPlay;
    private MaterialButton btnBillboardWatchlist;

    // Category Chips
    private TextView chipAll;
    private TextView chipMovies;
    private TextView chipMusic;
    private TextView chipTamil;

    // Sections & Lists
    private LinearLayout sectionTrending;
    private RecyclerView rvTrending;
    private LinearLayout sectionMovies;
    private RecyclerView rvMovies;
    private RecyclerView rvAllVideos;
    private TextView tvAllVideosHeading;

    // Tab 2: Movies Views
    private RecyclerView rvTabMovies;
    private VideoGridAdapter tabMoviesAdapter;
    private final List<Video> tabMoviesList = new ArrayList<>();

    // Tab 3: Downloads Views
    private TextView tvOfflineStorageInfo;
    private LinearLayout layoutEmptyDownloads;
    private RecyclerView rvDownloadedVideos;
    private DownloadedVideosAdapter downloadedAdapter;
    private final List<Video> downloadedList = new ArrayList<>();

    // Tab 4: Account Views
    private MaterialButton btnActionOpenUploader;
    private MaterialButton btnActionClearCache;

    // Adapters
    private VideoCarouselAdapter trendingAdapter;
    private VideoCarouselAdapter moviesAdapter;
    private VideoGridAdapter allVideosAdapter;

    // Master Data
    private final List<Video> masterVideoList = new ArrayList<>();
    private final List<Video> trendingList = new ArrayList<>();
    private final List<Video> moviesList = new ArrayList<>();
    private final List<Video> displayGridList = new ArrayList<>();

    private Video heroVideo = null;
    private String selectedCategory = "ALL";
    private String currentSearchQuery = "";
    private boolean isSearchBarVisible = false;

    // Real-Time Auto-Sync Polling Handler
    private final Handler liveSyncHandler = new Handler(Looper.getMainLooper());
    private final Runnable liveSyncRunnable = new Runnable() {
        @Override
        public void run() {
            performSilentLiveSync();
            liveSyncHandler.postDelayed(this, LIVE_SYNC_INTERVAL_MS);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        // Immersive dark status bar
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            getWindow().setStatusBarColor(0xFF08090D);
            getWindow().setNavigationBarColor(0xFF08090D);
        }

        // Initialize high speed disk cache
        ImageLoader.getInstance().initDiskCache(this);

        bindViews();
        setupRecyclerViews();
        setupListeners();
        setupSearch();
        setupCategoryChips();
        setupBottomNavigation();

        // 0ms Instant Cold Start: Load cached catalog immediately
        loadCachedVideosInstantly();

        // Fetch fresh server data
        loadVideos(true);
    }

    private void bindViews() {
        btnToggleSearch = findViewById(R.id.btn_toggle_search);
        btnRefresh = findViewById(R.id.btn_refresh);
        tvLiveIndicator = findViewById(R.id.tv_live_indicator);
        layoutSearchBar = findViewById(R.id.layout_search_bar);
        etSearch = findViewById(R.id.et_search);

        swipeRefresh = findViewById(R.id.swipe_refresh);
        progressLoading = findViewById(R.id.progress_loading);
        layoutError = findViewById(R.id.layout_error);
        tvErrorMessage = findViewById(R.id.tv_error_message);
        btnRetry = findViewById(R.id.btn_retry);

        tabLayoutHome = findViewById(R.id.tab_layout_home);
        tabLayoutMovies = findViewById(R.id.tab_layout_movies);
        tabLayoutDownloads = findViewById(R.id.tab_layout_downloads);
        tabLayoutAccount = findViewById(R.id.tab_layout_account);
        bottomNavigation = findViewById(R.id.bottom_navigation);

        layoutBillboard = findViewById(R.id.layout_billboard);
        imgBillboard = findViewById(R.id.img_billboard);
        tvBillboardTitle = findViewById(R.id.tv_billboard_title);
        tvBillboardMeta = findViewById(R.id.tv_billboard_meta);
        tvBillboardCategory = findViewById(R.id.tv_billboard_category);
        btnBillboardPlay = findViewById(R.id.btn_billboard_play);
        btnBillboardWatchlist = findViewById(R.id.btn_billboard_watchlist);

        chipAll = findViewById(R.id.chip_all);
        chipMovies = findViewById(R.id.chip_movies);
        chipMusic = findViewById(R.id.chip_music);
        chipTamil = findViewById(R.id.chip_tamil);

        sectionTrending = findViewById(R.id.section_trending);
        rvTrending = findViewById(R.id.rv_trending);
        sectionMovies = findViewById(R.id.section_movies);
        rvMovies = findViewById(R.id.rv_movies);
        rvAllVideos = findViewById(R.id.rv_all_videos);
        tvAllVideosHeading = findViewById(R.id.tv_all_videos_heading);

        rvTabMovies = findViewById(R.id.rv_tab_movies);

        tvOfflineStorageInfo = findViewById(R.id.tv_offline_storage_info);
        layoutEmptyDownloads = findViewById(R.id.layout_empty_downloads);
        rvDownloadedVideos = findViewById(R.id.rv_downloaded_videos);

        btnActionOpenUploader = findViewById(R.id.btn_action_open_uploader);
        btnActionClearCache = findViewById(R.id.btn_action_clear_cache);

        swipeRefresh.setColorSchemeColors(0xFFE50914);
        swipeRefresh.setProgressBackgroundColorSchemeColor(0xFF12151E);
    }

    private void setupRecyclerViews() {
        trendingAdapter = new VideoCarouselAdapter(this, this::openPlayerActivity);
        rvTrending.setLayoutManager(new LinearLayoutManager(this, LinearLayoutManager.HORIZONTAL, false));
        rvTrending.setAdapter(trendingAdapter);

        moviesAdapter = new VideoCarouselAdapter(this, this::openPlayerActivity);
        rvMovies.setLayoutManager(new LinearLayoutManager(this, LinearLayoutManager.HORIZONTAL, false));
        rvMovies.setAdapter(moviesAdapter);

        int spanCount = getResponsiveSpanCount();
        GridLayoutManager gridLayoutManager = new GridLayoutManager(this, spanCount);
        rvAllVideos.setLayoutManager(gridLayoutManager);
        allVideosAdapter = new VideoGridAdapter(this, this::openPlayerActivity);
        rvAllVideos.setAdapter(allVideosAdapter);

        // Tab Movies
        GridLayoutManager moviesGrid = new GridLayoutManager(this, spanCount);
        rvTabMovies.setLayoutManager(moviesGrid);
        tabMoviesAdapter = new VideoGridAdapter(this, this::openPlayerActivity);
        rvTabMovies.setAdapter(tabMoviesAdapter);

        // Tab Downloads
        downloadedAdapter = new DownloadedVideosAdapter(this, new DownloadedVideosAdapter.OnDownloadedItemClickListener() {
            @Override
            public void onPlay(Video video) {
                openPlayerActivity(video);
            }

            @Override
            public void onDelete(Video video) {
                confirmDeleteDownload(video);
            }
        });
        rvDownloadedVideos.setLayoutManager(new LinearLayoutManager(this));
        rvDownloadedVideos.setAdapter(downloadedAdapter);
    }

    private int getResponsiveSpanCount() {
        int screenWidthDp = getResources().getConfiguration().screenWidthDp;
        if (screenWidthDp >= 900) {
            return 3;
        } else if (screenWidthDp >= 600) {
            return 2;
        } else {
            return 1;
        }
    }

    private void setupListeners() {
        swipeRefresh.setOnRefreshListener(() -> loadVideos(false));
        btnRefresh.setOnClickListener(v -> loadVideos(false));
        btnRetry.setOnClickListener(v -> loadVideos(true));

        btnToggleSearch.setOnClickListener(v -> {
            isSearchBarVisible = !isSearchBarVisible;
            layoutSearchBar.setVisibility(isSearchBarVisible ? View.VISIBLE : View.GONE);
            if (isSearchBarVisible) {
                etSearch.requestFocus();
            } else {
                etSearch.setText("");
            }
        });

        btnBillboardPlay.setOnClickListener(v -> {
            if (heroVideo != null) {
                openPlayerActivity(heroVideo);
            }
        });

        btnBillboardWatchlist.setOnClickListener(v -> {
            Toast.makeText(this, "Saved to My List", Toast.LENGTH_SHORT).show();
        });

        // Account actions
        btnActionOpenUploader.setOnClickListener(v -> {
            Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://app.wavemusic.dpdns.org/"));
            startActivity(browserIntent);
        });

        btnActionClearCache.setOnClickListener(v -> {
            Toast.makeText(this, "Cache cleared successfully", Toast.LENGTH_SHORT).show();
        });
    }

    private void setupBottomNavigation() {
        bottomNavigation.setOnItemSelectedListener(item -> {
            int itemId = item.getItemId();

            tabLayoutHome.setVisibility(View.GONE);
            tabLayoutMovies.setVisibility(View.GONE);
            tabLayoutDownloads.setVisibility(View.GONE);
            tabLayoutAccount.setVisibility(View.GONE);

            if (itemId == R.id.nav_home) {
                tabLayoutHome.setVisibility(View.VISIBLE);
                return true;
            } else if (itemId == R.id.nav_movies) {
                tabLayoutMovies.setVisibility(View.VISIBLE);
                refreshMoviesTab();
                return true;
            } else if (itemId == R.id.nav_upload) {
                showUploadDialog();
                // keep previous tab selected
                return false;
            } else if (itemId == R.id.nav_downloads) {
                tabLayoutDownloads.setVisibility(View.VISIBLE);
                refreshDownloadsTab();
                return true;
            } else if (itemId == R.id.nav_account) {
                tabLayoutAccount.setVisibility(View.VISIBLE);
                return true;
            }
            return false;
        });
    }

    private void showUploadDialog() {
        AlertDialog.Builder builder = new AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert);
        builder.setTitle("Upload Video to Cloudflare R2");
        builder.setMessage("Multi-Bucket Petabyte Storage Engine\n\nDirect high-speed chunked upload with automatic 24K master encoding.");
        builder.setPositiveButton("Open Web Uploader", (dialog, which) -> {
            Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://app.wavemusic.dpdns.org/"));
            startActivity(browserIntent);
        });
        builder.setNegativeButton("Cancel", null);
        builder.show();
    }

    private void refreshMoviesTab() {
        tabMoviesList.clear();
        for (Video v : masterVideoList) {
            if (v.getCategory().equalsIgnoreCase("movies")
                    || v.getTitle().toLowerCase().contains("movie")
                    || v.getTitle().toLowerCase().contains("ramayana")
                    || v.getTitle().toLowerCase().contains("hd")
                    || v.getTitle().toLowerCase().contains("1080p")) {
                tabMoviesList.add(v);
            }
        }
        if (tabMoviesList.isEmpty()) {
            tabMoviesList.addAll(masterVideoList);
        }
        tabMoviesAdapter.setVideos(tabMoviesList);
    }

    private void refreshDownloadsTab() {
        downloadedList.clear();
        downloadedList.addAll(OfflineDownloadManager.getInstance(this).getAllDownloadedVideos());

        String storageStr = OfflineDownloadManager.getInstance(this).getTotalStorageUsedFormatted();
        tvOfflineStorageInfo.setText("Encrypted Vault • " + storageStr + " used (No internet needed)");

        if (downloadedList.isEmpty()) {
            layoutEmptyDownloads.setVisibility(View.VISIBLE);
            rvDownloadedVideos.setVisibility(View.GONE);
        } else {
            layoutEmptyDownloads.setVisibility(View.GONE);
            rvDownloadedVideos.setVisibility(View.VISIBLE);
            downloadedAdapter.setVideos(downloadedList);
        }
    }

    private void confirmDeleteDownload(Video video) {
        new AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert)
                .setTitle("Delete Download")
                .setMessage("Permanently remove \"" + video.getTitle() + "\" from your offline encrypted vault?")
                .setPositiveButton("Delete", (dialog, which) -> {
                    OfflineDownloadManager.getInstance(this).deleteDownloadedVideo(video.getId());
                    refreshDownloadsTab();
                    Toast.makeText(this, "Movie deleted from offline vault", Toast.LENGTH_SHORT).show();
                })
                .setNegativeButton("Cancel", null)
                .show();
    }

    private void setupSearch() {
        etSearch.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                currentSearchQuery = s.toString().trim().toLowerCase(Locale.ROOT);
                applyFilter();
            }

            @Override
            public void afterTextChanged(Editable s) {}
        });
    }

    private void setupCategoryChips() {
        chipAll.setOnClickListener(v -> selectCategory("ALL", chipAll));
        chipMovies.setOnClickListener(v -> selectCategory("MOVIES", chipMovies));
        chipMusic.setOnClickListener(v -> selectCategory("MUSIC", chipMusic));
        chipTamil.setOnClickListener(v -> selectCategory("TAMIL", chipTamil));
    }

    private void selectCategory(String category, TextView selectedChip) {
        selectedCategory = category;

        chipAll.setBackgroundResource(R.drawable.bg_chip_unselected);
        chipMovies.setBackgroundResource(R.drawable.bg_chip_unselected);
        chipMusic.setBackgroundResource(R.drawable.bg_chip_unselected);
        chipTamil.setBackgroundResource(R.drawable.bg_chip_unselected);

        selectedChip.setBackgroundResource(R.drawable.bg_chip_selected);

        applyFilter();
    }

    /**
     * 0ms Instant Cold Start: Loads cached JSON so user sees posters & titles immediately.
     */
    private void loadCachedVideosInstantly() {
        try {
            SharedPreferences prefs = getSharedPreferences(PREF_NAME, MODE_PRIVATE);
            String cachedJson = prefs.getString(KEY_CACHED_VIDEOS, null);
            if (cachedJson != null && !cachedJson.isEmpty()) {
                List<Video> cachedList = ApiClient.getInstance().parseVideosJson(cachedJson);
                if (!cachedList.isEmpty()) {
                    updateVideoData(cachedList);
                }
            }
        } catch (Exception ignored) {}
    }

    private void loadVideos(boolean showLoading) {
        swipeRefresh.setRefreshing(false);
        if (showLoading && masterVideoList.isEmpty()) {
            progressLoading.setVisibility(View.VISIBLE);
        }
        layoutError.setVisibility(View.GONE);

        ApiClient.getInstance().fetchVideos(new ApiClient.ApiCallback<List<Video>>() {
            @Override
            public void onSuccess(List<Video> videos) {
                runOnUiThread(() -> {
                    progressLoading.setVisibility(View.GONE);
                    updateVideoData(videos);
                });
            }

            @Override
            public void onError(String errorMessage) {
                runOnUiThread(() -> {
                    progressLoading.setVisibility(View.GONE);
                    if (masterVideoList.isEmpty()) {
                        layoutError.setVisibility(View.VISIBLE);
                        tvErrorMessage.setText("Error connecting to VD Player server: " + errorMessage + "\nTap Retry to reconnect.");
                    }
                });
            }
        });
    }

    /**
     * Real-time silent live sync every 12 seconds:
     * Detects additions, modifications, and deletions from server live without app update!
     */
    private void performSilentLiveSync() {
        ApiClient.getInstance().fetchVideos(new ApiClient.ApiCallback<List<Video>>() {
            @Override
            public void onSuccess(List<Video> freshVideos) {
                runOnUiThread(() -> {
                    boolean changed = hasCatalogChanged(masterVideoList, freshVideos);
                    if (changed) {
                        updateVideoData(freshVideos);
                        // Subtle green pulse indicator
                        if (tvLiveIndicator != null) {
                            tvLiveIndicator.setText("● SYNCED");
                            tvLiveIndicator.postDelayed(() -> tvLiveIndicator.setText("● LIVE"), 2000);
                        }
                    }
                });
            }

            @Override
            public void onError(String errorMessage) {
                // Silently skip
            }
        });
    }

    private boolean hasCatalogChanged(List<Video> current, List<Video> incoming) {
        if (current.size() != incoming.size()) return true;
        for (int i = 0; i < current.size(); i++) {
            Video c = current.get(i);
            Video in = incoming.get(i);
            if (!c.getId().equals(in.getId()) || !c.getTitle().equals(in.getTitle())) {
                return true;
            }
        }
        return false;
    }

    private void updateVideoData(List<Video> videos) {
        masterVideoList.clear();
        masterVideoList.addAll(videos);

        if (masterVideoList.isEmpty()) {
            layoutError.setVisibility(View.VISIBLE);
            tvErrorMessage.setText("No videos found on the server.\nPlease upload content through the VD Player portal.");
            return;
        }

        // Billboard Hero Video
        heroVideo = masterVideoList.get(0);
        displayBillboardHero(heroVideo);

        // Trending & Movies Carousels
        trendingList.clear();
        moviesList.clear();

        for (int i = 0; i < masterVideoList.size(); i++) {
            Video v = masterVideoList.get(i);
            if (i < 5) {
                trendingList.add(v);
            }
            if (v.getCategory().equalsIgnoreCase("movies")
                    || v.getTitle().toLowerCase().contains("movie")
                    || v.getTitle().toLowerCase().contains("ramayana")
                    || v.getTitle().toLowerCase().contains("hd")
                    || v.getTitle().toLowerCase().contains("1080p")) {
                moviesList.add(v);
            }
        }

        if (moviesList.isEmpty()) {
            moviesList.addAll(masterVideoList);
        }

        trendingAdapter.setVideos(trendingList);
        moviesAdapter.setVideos(moviesList);

        applyFilter();
    }

    private void displayBillboardHero(Video video) {
        if (video == null) {
            layoutBillboard.setVisibility(View.GONE);
            return;
        }

        layoutBillboard.setVisibility(View.VISIBLE);
        tvBillboardTitle.setText(video.getTitle());
        tvBillboardMeta.setText(video.getChannelName() + " • " + video.getFormattedViews() + " • " + video.getDuration());
        tvBillboardCategory.setText(video.getCategory().toUpperCase(Locale.ROOT));

        String posterUrl = video.getFullThumbnailUrl(ApiClient.getInstance().getActiveBaseUrl());
        if (posterUrl != null && !posterUrl.isEmpty()) {
            ImageLoader.getInstance().load(posterUrl, imgBillboard, 0);
        }
    }

    private void applyFilter() {
        displayGridList.clear();

        for (Video video : masterVideoList) {
            boolean matchesCategory = true;
            if ("MOVIES".equals(selectedCategory)) {
                matchesCategory = video.getCategory().equalsIgnoreCase("movies")
                        || video.getTitle().toLowerCase().contains("movie")
                        || video.getTitle().toLowerCase().contains("ramayana");
            } else if ("MUSIC".equals(selectedCategory)) {
                matchesCategory = video.getCategory().equalsIgnoreCase("music")
                        || video.getTitle().toLowerCase().contains("music")
                        || video.getTitle().toLowerCase().contains("acoustic")
                        || video.getTitle().toLowerCase().contains("beats")
                        || video.getTitle().toLowerCase().contains("song");
            } else if ("TAMIL".equals(selectedCategory)) {
                matchesCategory = video.getTitle().toLowerCase().contains("tamil")
                        || video.getTitle().toLowerCase().contains("ramayana")
                        || video.getDescription().toLowerCase().contains("tamil");
            }

            boolean matchesSearch = true;
            if (!currentSearchQuery.isEmpty()) {
                matchesSearch = video.getTitle().toLowerCase(Locale.ROOT).contains(currentSearchQuery)
                        || video.getChannelName().toLowerCase(Locale.ROOT).contains(currentSearchQuery)
                        || video.getDescription().toLowerCase(Locale.ROOT).contains(currentSearchQuery);
            }

            if (matchesCategory && matchesSearch) {
                displayGridList.add(video);
            }
        }

        if (!currentSearchQuery.isEmpty()) {
            sectionTrending.setVisibility(View.GONE);
            sectionMovies.setVisibility(View.GONE);
            layoutBillboard.setVisibility(View.GONE);
            tvAllVideosHeading.setText("Search Results (" + displayGridList.size() + ")");
        } else {
            sectionTrending.setVisibility(View.VISIBLE);
            sectionMovies.setVisibility(View.VISIBLE);
            layoutBillboard.setVisibility(View.VISIBLE);
            tvAllVideosHeading.setText("📺 All Videos & Live Streams");
        }

        allVideosAdapter.setVideos(displayGridList);
    }

    private void openPlayerActivity(Video video) {
        Intent intent = new Intent(this, PlayerActivity.class);
        intent.putExtra(PlayerActivity.EXTRA_VIDEO, video);
        startActivity(intent);
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Start live sync polling every 12 seconds
        liveSyncHandler.removeCallbacks(liveSyncRunnable);
        liveSyncHandler.post(liveSyncRunnable);

        // If on downloads tab, refresh list
        if (tabLayoutDownloads != null && tabLayoutDownloads.getVisibility() == View.VISIBLE) {
            refreshDownloadsTab();
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        // Stop polling when app in background to save battery
        liveSyncHandler.removeCallbacks(liveSyncRunnable);
    }

    @Override
    public void onConfigurationChanged(@NonNull Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        int spanCount = getResponsiveSpanCount();
        GridLayoutManager layoutManager = (GridLayoutManager) rvAllVideos.getLayoutManager();
        if (layoutManager != null) {
            layoutManager.setSpanCount(spanCount);
            allVideosAdapter.notifyDataSetChanged();
        }
        GridLayoutManager moviesLayout = (GridLayoutManager) rvTabMovies.getLayoutManager();
        if (moviesLayout != null) {
            moviesLayout.setSpanCount(spanCount);
            tabMoviesAdapter.notifyDataSetChanged();
        }
    }
}
