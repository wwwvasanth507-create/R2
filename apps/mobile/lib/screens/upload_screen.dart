import 'package:flutter/material.dart';
import '../services/chunk_uploader_service.dart';
import '../core/constants.dart';

class UploadScreen extends StatefulWidget {
  const UploadScreen({Key? key}) : super(key: key);

  @override
  State<UploadScreen> createState() => _UploadScreenState();
}

class _UploadScreenState extends State<UploadScreen> {
  final ChunkUploaderService _uploaderService = ChunkUploaderService();
  bool _isUploading = false;
  double _progress = 0.0;
  int _currentChunk = 0;
  int _totalChunks = 0;
  int _selectedBytes = 20 * 1024 * 1024 * 1024; // 20 GiB

  Future<void> _startUpload() async {
    setState(() {
      _isUploading = true;
      _progress = 0.0;
    });

    try {
      // 1. Create upload session via backend API
      final session = await _uploaderService.createSession(
        filename: 'mobile_recorded_4k.mov',
        totalSizeBytes: _selectedBytes,
        mimeType: 'video/quicktime',
      );

      final chunksJson = session['chunks'] as List<dynamic>;
      final chunkItems = chunksJson
          .map(
            (c) => ChunkUploadItem(
              chunkIndex: c['chunkIndex'],
              byteStart: c['byteStart'],
              byteEnd: c['byteEnd'],
              chunkSizeBytes: c['chunkSizeBytes'],
              bucketName: c['bucketName'],
              presignedUploadUrl: c['presignedUploadUrl'],
            ),
          )
          .toList();

      setState(() {
        _totalChunks = chunkItems.length;
      });

      // 2. Stream chunks sequentially to R2 presigned URLs
      await _uploaderService.uploadChunks(
        fileId: session['fileId'],
        chunks: chunkItems,
        onProgress: (prog, curr, tot) {
          setState(() {
            _progress = prog;
            _currentChunk = curr;
          });
        },
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Upload info: $e')),
      );
    } finally {
      setState(() {
        _isUploading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF090A0F),
      appBar: AppBar(
        backgroundColor: const Color(0xFF090A0F),
        title: const Text('R2 Chunk Uploader (20GB)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
      ),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFF111827),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFF1F2937)),
              ),
              child: Column(
                children: [
                  const Icon(Icons.cloud_upload_outlined, size: 48, color: Color(0xFFE50914)),
                  const SizedBox(height: 12),
                  Text(
                    'Simulated 20 GiB Large-File',
                    style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Automatically split into 256 MiB chunks and distributed across Cloudflare R2 buckets under 8 GiB logical quotas.',
                    style: TextStyle(color: Colors.white60, fontSize: 12),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            if (_isUploading) ...[
              Text(
                'Chunk $_currentChunk of $_totalChunks (${(_progress * 100).toStringAsFixed(0)}%)',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              LinearProgressIndicator(
                value: _progress,
                color: const Color(0xFFE50914),
                backgroundColor: Colors.grey.shade800,
                minHeight: 8,
              ),
              const SizedBox(height: 16),
            ],
            ElevatedButton.icon(
              onPressed: _isUploading ? null : _startUpload,
              icon: const Icon(Icons.upload, color: Colors.white),
              label: Text(_isUploading ? 'Uploading Chunks...' : 'Start 20 GiB R2 Upload'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFE50914),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
