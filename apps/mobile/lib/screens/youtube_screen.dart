import 'package:flutter/material.dart';

class YouTubeScreen extends StatelessWidget {
  const YouTubeScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F0F0F),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F0F0F),
        title: Row(
          children: const [
            Icon(Icons.play_circle_fill, color: Color(0xFFEF4444)),
            SizedBox(width: 8),
            Text('YouTube', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
          ],
        ),
      ),
      body: ListView(
        children: [
          // Shorts Shelf
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: const [
                Icon(Icons.flash_on, color: Color(0xFFEF4444), size: 18),
                SizedBox(width: 6),
                Text('Shorts', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
              ],
            ),
          ),
          SizedBox(
            height: 220,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              children: [
                _buildShortItem('DaVinci Resolve Contrast Tricks', 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=400'),
                _buildShortItem('20GB R2 Uploads Explained', 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400'),
              ],
            ),
          ),

          const Divider(color: Colors.white24, height: 28),

          // Standard Feed
          _buildVideoItem(
            'Building a Distributed 20GB Video Storage Engine with Cloudflare R2',
            'Cinematic Studios Official • 12K views • 3 hours ago',
            '14:20',
            'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800',
          ),
        ],
      ),
    );
  }

  Widget _buildShortItem(String title, String image) {
    return Container(
      width: 130,
      margin: const EdgeInsets.only(right: 10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8),
        image: DecorationImage(image: NetworkImage(image), fit: BoxFit.cover),
      ),
      alignment: Alignment.bottomLeft,
      padding: const EdgeInsets.all(8),
      child: Text(
        title,
        style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
      ),
    );
  }

  Widget _buildVideoItem(String title, String subtitle, String duration, String thumb) {
    return Column(
      children: [
        Stack(
          children: [
            AspectRatio(
              aspectRatio: 16 / 9,
              child: Image.network(thumb, fit: BoxFit.cover),
            ),
            Positioned(
              bottom: 8,
              right: 8,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                color: Colors.black87,
                child: Text(duration, style: const TextStyle(color: Colors.white, fontSize: 11)),
              ),
            ),
          ],
        ),
        Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const CircleAvatar(
                backgroundImage: NetworkImage('https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100'),
                radius: 18,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                    const SizedBox(height: 4),
                    Text(subtitle, style: const TextStyle(color: Colors.white54, fontSize: 12)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
