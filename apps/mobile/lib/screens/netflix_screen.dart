import 'package:flutter/material.dart';
import '../widgets/hls_player_widget.dart';

class NetflixScreen extends StatelessWidget {
  const NetflixScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF090A0F),
      body: CustomScrollView(
        slivers: [
          // Netflix App Bar
          SliverAppBar(
            backgroundColor: const Color(0xFF090A0F).withOpacity(0.9),
            floating: true,
            pinned: false,
            title: Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE50914),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text('NETFLIX', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14)),
                ),
                const SizedBox(width: 16),
                const Text('Movies', style: TextStyle(fontSize: 14, color: Colors.white70)),
                const SizedBox(width: 16),
                const Text('Series', style: TextStyle(fontSize: 14, color: Colors.white70)),
              ],
            ),
          ),

          // Billboard Hero Banner
          SliverToBoxAdapter(
            child: Container(
              height: 400,
              decoration: const BoxDecoration(
                image: DecorationImage(
                  image: NetworkImage('https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1000'),
                  fit: BoxFit.cover,
                ),
              ),
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Colors.transparent, const Color(0xFF090A0F).withOpacity(0.95)],
                  ),
                ),
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    const Text(
                      'STELLAR HORIZON: 2099',
                      style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: Colors.white, letterSpacing: 1),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    const Text('Sci-Fi • Cyberpunk • 4K HLS ABR', style: TextStyle(color: Colors.white70, fontSize: 13)),
                    const SizedBox(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        ElevatedButton.icon(
                          onPressed: () {
                            showModalBottomSheet(
                              context: context,
                              isScrollControlled: true,
                              backgroundColor: Colors.black,
                              builder: (_) => const SizedBox(
                                height: 300,
                                child: HlsPlayerWidget(
                                  title: 'Stellar Horizon: 2099',
                                  videoUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
                                ),
                              ),
                            );
                          },
                          icon: const Icon(Icons.play_arrow, color: Colors.black),
                          label: const Text('Play', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
                          style: ElevatedButton.styleFrom(backgroundColor: Colors.white),
                        ),
                        const SizedBox(width: 16),
                        OutlinedButton.icon(
                          onPressed: () {},
                          icon: const Icon(Icons.add, color: Colors.white),
                          label: const Text('Watchlist', style: TextStyle(color: Colors.white)),
                          style: OutlinedButton.styleFrom(side: const BorderSide(color: Colors.white)),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),

          // Continue Watching Row
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Continue Watching', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
                  const SizedBox(height: 12),
                  SizedBox(
                    height: 140,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      children: [
                        _buildMovieCard(
                          'Neon Odyssey (S1:E1)',
                          'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=500',
                          progress: 0.65,
                        ),
                        _buildMovieCard(
                          'Cyberpunk Chronicles',
                          'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=500',
                          progress: 0.30,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMovieCard(String title, String imageUrl, {double? progress}) {
    return Container(
      width: 180,
      margin: const EdgeInsets.only(right: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF111827),
        borderRadius: BorderRadius.circular(8),
        image: DecorationImage(image: NetworkImage(imageUrl), fit: BoxFit.cover),
      ),
      child: Stack(
        children: [
          if (progress != null)
            Align(
              alignment: Alignment.bottomCenter,
              child: LinearProgressIndicator(
                value: progress,
                backgroundColor: Colors.grey.shade800,
                color: const Color(0xFFE50914),
                minHeight: 4,
              ),
            ),
        ],
      ),
    );
  }
}
