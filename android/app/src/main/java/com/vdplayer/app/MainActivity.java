package com.vdplayer.app;

import android.content.Intent;
import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
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
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.GridLayoutManager;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.google.android.material.button.MaterialButton;
import com.vdplayer.app.adapter.VideoCarouselAdapter;
import com.vdplayer.app.adapter.VideoGridAdapter;
import com.vdplayer.app.model.Video;
import com.vdplayer.app.network.ApiClient;
import com.vdplayer.app.network.ImageLoader;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class MainActivity extends AppCompatActivity {

    private ImageView btnToggleSearch;
    private ImageView btnRefresh;
    private LinearLayout layoutSearchBar;
    private EditText etSearch;

    private SwipeRefreshLayout swipeRefresh;
    private ProgressBar progressLoading;
    private LinearLayout layoutError;
    private TextView tvErrorMessage;
    private MaterialButton btnRetry;

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

    // Adapters
    private VideoCarouselAdapter trendingAdapter;
    private VideoCarouselAdapter moviesAdapter;
    private VideoGridAdapter allVideosAdapter;

    // Data lists
    private final List<Video> masterVideoList = new ArrayList<>();
    private final List<Video> trendingList = new ArrayList<>();
    private final List<Video> moviesList = new ArrayList<>();
    private final List<Video> displayGridList = new ArrayList<>();

    private Video heroVideo = null;
    private String selectedCategory = "ALL";
    private String currentSearchQuery = "";
    private boolean isSearchBarVisible = false;

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

        bindViews();
        setupRecyclerViews();
        setupListeners();
        setupSearch();
        setupCategoryChips();

        loadVideos();
    }

    private void bindViews() {
        btnToggleSearch = findViewById(R.id.btn_toggle_search);
        btnRefresh = findViewById(R.id.btn_refresh);
        layoutSearchBar = findViewById(R.id.layout_search_bar);
        etSearch = findViewById(R.id.et_search);

        swipeRefresh = findViewById(R.id.swipe_refresh);
        progressLoading = findViewById(R.id.progress_loading);
        layoutError = findViewById(R.id.layout_error);
        tvErrorMessage = findViewById(R.id.tv_error_message);
        btnRetry = findViewById(R.id.btn_retry);

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

        swipeRefresh.setColorSchemeColors(0xFFE50914);
        swipeRefresh.setProgressBackgroundColorSchemeColor(0xFF12151E);
    }

    private void setupRecyclerViews() {
        // Trending Horizontal Carousel
        trendingAdapter = new VideoCarouselAdapter(this, this::openPlayerActivity);
        rvTrending.setLayoutManager(new LinearLayoutManager(this, LinearLayoutManager.HORIZONTAL, false));
        rvTrending.setAdapter(trendingAdapter);

        // Movies Horizontal Carousel
        moviesAdapter = new VideoCarouselAdapter(this, this::openPlayerActivity);
        rvMovies.setLayoutManager(new LinearLayoutManager(this, LinearLayoutManager.HORIZONTAL, false));
        rvMovies.setAdapter(moviesAdapter);

        // All Videos Grid with Responsive Span Count
        int spanCount = getResponsiveSpanCount();
        GridLayoutManager gridLayoutManager = new GridLayoutManager(this, spanCount);
        rvAllVideos.setLayoutManager(gridLayoutManager);
        allVideosAdapter = new VideoGridAdapter(this, this::openPlayerActivity);
        rvAllVideos.setAdapter(allVideosAdapter);
    }

    private int getResponsiveSpanCount() {
        int screenWidthDp = getResources().getConfiguration().screenWidthDp;
        if (screenWidthDp >= 900) {
            return 3; // Large tablets & TV displays
        } else if (screenWidthDp >= 600) {
            return 2; // Foldables, small tablets, landscape phones
        } else {
            return 1; // Standard mobile phone portrait
        }
    }

    private void setupListeners() {
        swipeRefresh.setOnRefreshListener(this::loadVideos);
        btnRefresh.setOnClickListener(v -> loadVideos());
        btnRetry.setOnClickListener(v -> loadVideos());

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

        // Reset all chips to unselected
        chipAll.setBackgroundResource(R.drawable.bg_chip_unselected);
        chipMovies.setBackgroundResource(R.drawable.bg_chip_unselected);
        chipMusic.setBackgroundResource(R.drawable.bg_chip_unselected);
        chipTamil.setBackgroundResource(R.drawable.bg_chip_unselected);

        // Highlight selected chip
        selectedChip.setBackgroundResource(R.drawable.bg_chip_selected);

        applyFilter();
    }

    private void loadVideos() {
        swipeRefresh.setRefreshing(false);
        progressLoading.setVisibility(View.VISIBLE);
        layoutError.setVisibility(View.GONE);

        ApiClient.getInstance().fetchVideos(new ApiClient.ApiCallback<List<Video>>() {
            @Override
            public void onSuccess(List<Video> videos) {
                runOnUiThread(() -> {
                    progressLoading.setVisibility(View.GONE);
                    masterVideoList.clear();
                    masterVideoList.addAll(videos);

                    if (masterVideoList.isEmpty()) {
                        layoutError.setVisibility(View.VISIBLE);
                        tvErrorMessage.setText("No videos found on the server.\nPlease upload content through the VD Player portal.");
                        return;
                    }

                    // Billboard Hero Video (first video or featured)
                    heroVideo = masterVideoList.get(0);
                    displayBillboardHero(heroVideo);

                    // Separate into Trending (top 5), Movies, and Grid
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

                    // If moviesList is empty, copy master list so section is always populated
                    if (moviesList.isEmpty()) {
                        moviesList.addAll(masterVideoList);
                    }

                    trendingAdapter.setVideos(trendingList);
                    moviesAdapter.setVideos(moviesList);

                    applyFilter();
                });
            }

            @Override
            public void onError(String errorMessage) {
                runOnUiThread(() -> {
                    progressLoading.setVisibility(View.GONE);
                    layoutError.setVisibility(View.VISIBLE);
                    tvErrorMessage.setText("Error loading videos: " + errorMessage + "\nTap Retry to reconnect.");
                });
            }
        });
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

        // Hide horizontal sections if user is actively searching
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
    public void onConfigurationChanged(@NonNull Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        // Dynamically update span count for tablet rotation or landscape view
        int spanCount = getResponsiveSpanCount();
        GridLayoutManager layoutManager = (GridLayoutManager) rvAllVideos.getLayoutManager();
        if (layoutManager != null) {
            layoutManager.setSpanCount(spanCount);
            allVideosAdapter.notifyDataSetChanged();
        }
    }
}
