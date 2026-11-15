class AppConstants {
  static const String baseUrl = 'http://10.0.2.2:4000/api'; // Android emulator / iOS localhost
  static const int defaultChunkSizeBytes = 256 * 1024 * 1024; // 256 MiB
  static const int defaultLogicalQuotaBytes = 8 * 1024 * 1024 * 1024; // 8 GiB
  
  static String formatBytes(int bytes) {
    if (bytes >= 1024 * 1024 * 1024) {
      return '${(bytes / (1024 * 1024 * 1024)).toStringAsFixed(2)} GiB';
    } else {
      return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MiB';
    }
  }
}
