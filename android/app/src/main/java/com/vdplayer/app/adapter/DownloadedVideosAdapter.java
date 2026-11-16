package com.vdplayer.app.adapter;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.vdplayer.app.R;
import com.vdplayer.app.model.Video;
import com.vdplayer.app.network.ImageLoader;
import com.vdplayer.app.offline.OfflineDownloadManager;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class DownloadedVideosAdapter extends RecyclerView.Adapter<DownloadedVideosAdapter.ViewHolder> {

    public interface OnDownloadedItemClickListener {
        void onPlay(Video video);
        void onDelete(Video video);
    }

    private final Context context;
    private final List<Video> downloadedList = new ArrayList<>();
    private final OnDownloadedItemClickListener listener;

    public DownloadedVideosAdapter(Context context, OnDownloadedItemClickListener listener) {
        this.context = context;
        this.listener = listener;
    }

    public void setVideos(List<Video> list) {
        this.downloadedList.clear();
        if (list != null) {
            this.downloadedList.addAll(list);
        }
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(context).inflate(R.layout.item_downloaded_video, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        Video video = downloadedList.get(position);
        holder.tvTitle.setText(video.getTitle());
        holder.tvDuration.setText(video.getDuration());

        File mediaFile = OfflineDownloadManager.getInstance(context).getMediaFile(video.getId());
        String sizeStr = formatFileSize(mediaFile.length());
        holder.tvMeta.setText("Encrypted Vault • " + sizeStr);

        File thumbFile = OfflineDownloadManager.getInstance(context).getThumbnailFile(video.getId());
        if (thumbFile.exists()) {
            ImageLoader.getInstance().load("file://" + thumbFile.getAbsolutePath(), holder.ivThumb, 6);
        } else if (video.getThumbnailUrl() != null && !video.getThumbnailUrl().isEmpty()) {
            ImageLoader.getInstance().load(video.getThumbnailUrl(), holder.ivThumb, 6);
        }

        holder.btnPlay.setOnClickListener(v -> {
            if (listener != null) listener.onPlay(video);
        });

        holder.itemView.setOnClickListener(v -> {
            if (listener != null) listener.onPlay(video);
        });

        holder.btnDelete.setOnClickListener(v -> {
            if (listener != null) listener.onDelete(video);
        });
    }

    @Override
    public int getItemCount() {
        return downloadedList.size();
    }

    private String formatFileSize(long bytes) {
        if (bytes >= 1024 * 1024 * 1024) {
            return String.format(Locale.US, "%.2f GB", bytes / (1024.0 * 1024.0 * 1024.0));
        } else if (bytes >= 1024 * 1024) {
            return String.format(Locale.US, "%.1f MB", bytes / (1024.0 * 1024.0));
        } else if (bytes >= 1024) {
            return String.format(Locale.US, "%d KB", bytes / 1024);
        }
        return bytes + " B";
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        ImageView ivThumb;
        TextView tvDuration;
        TextView tvTitle;
        TextView tvMeta;
        ImageView btnPlay;
        ImageView btnDelete;

        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            ivThumb = itemView.findViewById(R.id.iv_offline_thumb);
            tvDuration = itemView.findViewById(R.id.tv_offline_duration);
            tvTitle = itemView.findViewById(R.id.tv_offline_title);
            tvMeta = itemView.findViewById(R.id.tv_offline_meta);
            btnPlay = itemView.findViewById(R.id.btn_offline_play);
            btnDelete = itemView.findViewById(R.id.btn_offline_delete);
        }
    }
}
