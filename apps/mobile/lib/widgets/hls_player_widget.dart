import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';
import 'package:chewie/chewie.dart';

class HlsPlayerWidget extends StatefulWidget {
  final String videoUrl;
  final String title;

  const HlsPlayerWidget({
    Key? key,
    required this.videoUrl,
    required this.title,
  }) : super(key: key);

  @override
  State<HlsPlayerWidget> createState() => _HlsPlayerWidgetState();
}

class _HlsPlayerWidgetState extends State<HlsPlayerWidget> {
  late VideoPlayerController _videoPlayerController;
  ChewieController? _chewieController;

  @override
  void initState() {
    super.initState();
    _initializePlayer();
  }

  Future<void> _initializePlayer() async {
    _videoPlayerController = VideoPlayerController.networkUrl(Uri.parse(widget.videoUrl));
    await _videoPlayerController.initialize();

    _chewieController = ChewieController(
      videoPlayerController: _videoPlayerController,
      autoPlay: true,
      looping: false,
      aspectRatio: _videoPlayerController.value.aspectRatio > 0
          ? _videoPlayerController.value.aspectRatio
          : 16 / 9,
      allowPlaybackSpeedChanging: true,
      playbackSpeeds: [0.5, 1.0, 1.25, 1.5, 2.0],
      materialProgressColors: ChewieProgressColors(
        playedColor: const Color(0xFFE50914),
        handleColor: const Color(0xFFE50914),
        backgroundColor: Colors.grey.shade800,
        bufferedColor: Colors.grey.shade600,
      ),
    );
    setState(() {});
  }

  @override
  void dispose() {
    _videoPlayerController.dispose();
    _chewieController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_chewieController != null && _chewieController!.videoPlayerController.value.isInitialized) {
      return AspectRatio(
        aspectRatio: _videoPlayerController.value.aspectRatio,
        child: Chewie(controller: _chewieController!),
      );
    }
    return Container(
      height: 220,
      color: Colors.black,
      child: const Center(
        child: CircularProgressIndicator(color: Color(0xFFE50914)),
      ),
    );
  }
}
