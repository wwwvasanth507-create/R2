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
import com.vdplayer.app.network.ApiClient;
import com.vdplayer.app.network.ImageLoader;

import java.util.ArrayList;
import java.util.List;

public class VideoGridAdapter extends RecyclerView.Adapter<VideoGridAdapter.ViewHolder> {

    public interface OnVideoClickListener {
        void onVideoClick(Video video);
    }

    private final Context context;
    private final List<Video> videoList = new ArrayList<>();
    private final OnVideoClickListener listener;

    public VideoGridAdapter(Context context, OnVideoClickListener listener) {
        this.context = context;
        this.listener = listener;
    }

    public void setVideos(List<Video> videos) {
        this.videoList.clear();
        if (videos != null) {
            this.videoList.addAll(videos);
        }
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(context).inflate(R.layout.item_video_grid, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        final Video video = videoList.get(position);
        holder.tvTitle.setText(video.getTitle());
        holder.tvDuration.setText(video.getFormattedDuration());
        holder.tvChannel.setText(video.getChannelTitle() + " • " + video.getFormattedViews());
        holder.tvCategory.setText(video.getCategory());

        String baseUrl = ApiClient.getInstance().getActiveBaseUrl();
        String thumbUrl = video.getFullThumbnailUrl(baseUrl);
        ImageLoader.getInstance().load(thumbUrl, holder.imgThumbnail, 8);

        holder.itemView.setOnClickListener(v -> {
            if (listener != null) {
                listener.onVideoClick(video);
            }
        });
    }

    @Override
    public int getItemCount() {
        return videoList.size();
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        ImageView imgThumbnail;
        TextView tvTitle;
        TextView tvDuration;
        TextView tvChannel;
        TextView tvCategory;

        ViewHolder(@NonNull View itemView) {
            super(itemView);
            imgThumbnail = itemView.findViewById(R.id.img_thumbnail);
            tvTitle = itemView.findViewById(R.id.tv_title);
            tvDuration = itemView.findViewById(R.id.tv_duration);
            tvChannel = itemView.findViewById(R.id.tv_channel);
            tvCategory = itemView.findViewById(R.id.tv_category);
        }
    }
}
