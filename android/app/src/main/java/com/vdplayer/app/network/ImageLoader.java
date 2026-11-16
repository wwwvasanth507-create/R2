package com.vdplayer.app.network;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.graphics.Rect;
import android.graphics.RectF;
import android.os.Handler;
import android.os.Looper;
import android.util.LruCache;
import android.widget.ImageView;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class ImageLoader {
    private static ImageLoader instance;
    private final LruCache<String, Bitmap> memoryCache;
    private final ExecutorService executorService;
    private final Handler mainHandler;
    private File diskCacheDir;

    private ImageLoader() {
        int maxMemory = (int) (Runtime.getRuntime().maxMemory() / 1024);
        int cacheSize = maxMemory / 6; // Fast LRU memory pool
        this.memoryCache = new LruCache<String, Bitmap>(cacheSize) {
            @Override
            protected int sizeOf(String key, Bitmap bitmap) {
                return bitmap.getByteCount() / 1024;
            }
        };
        this.executorService = Executors.newFixedThreadPool(6); // 6 parallel threads for lightning fast poster loads
        this.mainHandler = new Handler(Looper.getMainLooper());
    }

    public static synchronized ImageLoader getInstance() {
        if (instance == null) {
            instance = new ImageLoader();
        }
        return instance;
    }

    public void initDiskCache(Context context) {
        if (diskCacheDir == null && context != null) {
            diskCacheDir = new File(context.getCacheDir(), "img_cache");
            if (!diskCacheDir.exists()) {
                diskCacheDir.mkdirs();
            }
        }
    }

    public void load(String url, ImageView imageView) {
        load(url, imageView, 0);
    }

    public void load(String url, ImageView imageView, int cornerRadiusDp) {
        if (url == null || url.isEmpty() || imageView == null) {
            if (imageView != null) imageView.setImageDrawable(null);
            return;
        }

        // Check memory cache first (0ms instantaneous display)
        Bitmap cached = memoryCache.get(url);
        if (cached != null) {
            imageView.setImageBitmap(cached);
            return;
        }

        imageView.setTag(url);
        executorService.submit(() -> {
            try {
                Bitmap bitmap = null;

                // Handle Local Files (e.g., Offline Downloaded Thumbnails)
                if (url.startsWith("/") || url.startsWith("file://")) {
                    String localPath = url.startsWith("file://") ? url.substring(7) : url;
                    File f = new File(localPath);
                    if (f.exists()) {
                        bitmap = decodeSampledBitmapFromFile(f.getAbsolutePath(), 480, 270);
                    }
                } else {
                    // Check local disk cache first
                    String hashName = String.valueOf(url.hashCode()) + ".thumb";
                    File diskCachedFile = diskCacheDir != null ? new File(diskCacheDir, hashName) : null;
                    if (diskCachedFile != null && diskCachedFile.exists() && diskCachedFile.length() > 0) {
                        bitmap = decodeSampledBitmapFromFile(diskCachedFile.getAbsolutePath(), 480, 270);
                    }

                    // Not on disk, fetch via HTTP
                    if (bitmap == null) {
                        URL imageUrl = new URL(url);
                        HttpURLConnection conn = (HttpURLConnection) imageUrl.openConnection();
                        conn.setRequestProperty("User-Agent", "VDPlayer-Android/1.0");
                        conn.setConnectTimeout(8000);
                        conn.setReadTimeout(12000);
                        conn.setInstanceFollowRedirects(true);
                        conn.connect();

                        if (conn.getResponseCode() == HttpURLConnection.HTTP_OK) {
                            InputStream input = conn.getInputStream();
                            if (diskCachedFile != null) {
                                FileOutputStream fos = new FileOutputStream(diskCachedFile);
                                byte[] buf = new byte[8192];
                                int len;
                                while ((len = input.read(buf)) != -1) {
                                    fos.write(buf, 0, len);
                                }
                                fos.flush();
                                fos.close();
                                input.close();
                                bitmap = decodeSampledBitmapFromFile(diskCachedFile.getAbsolutePath(), 480, 270);
                            } else {
                                bitmap = BitmapFactory.decodeStream(input);
                                input.close();
                            }
                        }
                        conn.disconnect();
                    }
                }

                if (bitmap != null) {
                    if (cornerRadiusDp > 0) {
                        bitmap = getRoundedCornerBitmap(bitmap, cornerRadiusDp * 2);
                    }
                    final Bitmap finalBitmap = bitmap;
                    memoryCache.put(url, finalBitmap);

                    mainHandler.post(() -> {
                        String tag = (String) imageView.getTag();
                        if (tag != null && tag.equals(url)) {
                            imageView.setImageBitmap(finalBitmap);
                        }
                    });
                }
            } catch (Exception ignored) {}
        });
    }

    private Bitmap decodeSampledBitmapFromFile(String path, int reqWidth, int reqHeight) {
        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inJustDecodeBounds = true;
        BitmapFactory.decodeFile(path, options);

        options.inSampleSize = calculateInSampleSize(options, reqWidth, reqHeight);
        options.inJustDecodeBounds = false;
        options.inPreferredConfig = Bitmap.Config.RGB_565; // Uses 50% less RAM, extremely fast
        return BitmapFactory.decodeFile(path, options);
    }

    private int calculateInSampleSize(BitmapFactory.Options options, int reqWidth, int reqHeight) {
        final int height = options.outHeight;
        final int width = options.outWidth;
        int inSampleSize = 1;

        if (height > reqHeight || width > reqWidth) {
            final int halfHeight = height / 2;
            final int halfWidth = width / 2;
            while ((halfHeight / inSampleSize) >= reqHeight && (halfWidth / inSampleSize) >= reqWidth) {
                inSampleSize *= 2;
            }
        }
        return inSampleSize;
    }

    private Bitmap getRoundedCornerBitmap(Bitmap bitmap, int pixels) {
        try {
            Bitmap output = Bitmap.createBitmap(bitmap.getWidth(), bitmap.getHeight(), Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(output);

            final int color = 0xff424242;
            final Paint paint = new Paint();
            final Rect rect = new Rect(0, 0, bitmap.getWidth(), bitmap.getHeight());
            final RectF rectF = new RectF(rect);

            paint.setAntiAlias(true);
            canvas.drawARGB(0, 0, 0, 0);
            paint.setColor(color);
            canvas.drawRoundRect(rectF, (float) pixels, (float) pixels, paint);

            paint.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.SRC_IN));
            canvas.drawBitmap(bitmap, rect, rect, paint);

            return output;
        } catch (Throwable t) {
            return bitmap;
        }
    }
}
