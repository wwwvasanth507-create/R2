import 'package:flutter/material.dart';

class InstagramScreen extends StatelessWidget {
  const InstagramScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        title: const Text('Instagram', style: TextStyle(fontFamily: 'serif', fontSize: 22, fontWeight: FontWeight.bold)),
        actions: [
          IconButton(icon: const Icon(Icons.favorite_border), onPressed: () {}),
          IconButton(icon: const Icon(Icons.send_outlined), onPressed: () {}),
        ],
      ),
      body: ListView(
        children: [
          // Stories Tray
          SizedBox(
            height: 96,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              children: [
                _buildStory('Your Story', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100', isMine: true),
                _buildStory('cinematic', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100'),
                _buildStory('director_sarah', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100'),
              ],
            ),
          ),

          const Divider(color: Colors.white12, height: 1),

          // Feed Post
          _buildPost(
            'cinematic_studios',
            'Mojave Desert, California',
            'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=1080',
            'Golden hour anamorphic rig test on location in the desert. 🌅🎥',
            3412,
          ),
        ],
      ),
    );
  }

  Widget _buildStory(String name, String image, {bool isMine = false}) {
    return Padding(
      padding: const EdgeInsets.only(right: 14),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(2.5),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: isMine
                  ? null
                  : const LinearGradient(colors: [Colors.amber, Colors.pink, Colors.purple]),
            ),
            child: CircleAvatar(radius: 30, backgroundImage: NetworkImage(image)),
          ),
          const SizedBox(height: 4),
          Text(name, style: const TextStyle(color: Colors.white, fontSize: 11)),
        ],
      ),
    );
  }

  Widget _buildPost(String user, String location, String image, String caption, int likes) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ListTile(
          leading: const CircleAvatar(radius: 16, backgroundImage: NetworkImage('https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100')),
          title: Text(user, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
          subtitle: Text(location, style: const TextStyle(color: Colors.white54, fontSize: 11)),
          trailing: const Icon(Icons.more_vert, color: Colors.white),
        ),
        AspectRatio(aspectRatio: 1, child: Image.network(image, fit: BoxFit.cover)),
        Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: const [
                  Icon(Icons.favorite_border, color: Colors.white),
                  SizedBox(width: 16),
                  Icon(Icons.chat_bubble_outline, color: Colors.white),
                  SizedBox(width: 16),
                  Icon(Icons.send_outlined, color: Colors.white),
                  Spacer(),
                  Icon(Icons.bookmark_border, color: Colors.white),
                ],
              ),
              const SizedBox(height: 8),
              Text('$likes likes', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
              const SizedBox(height: 4),
              RichText(
                text: TextSpan(
                  children: [
                    TextSpan(text: '$user ', style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
                    TextSpan(text: caption, style: const TextStyle(color: Colors.white)),
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
