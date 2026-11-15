import 'dart:convert';
import 'package:http/http.dart' as http;
import '../core/constants.dart';

class ApiService {
  String? _accessToken;

  void setToken(String token) {
    _accessToken = token;
  }

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (_accessToken != null) 'Authorization': 'Bearer $_accessToken',
      };

  // --- Netflix ---
  Future<Map<String, dynamic>> getFeaturedNetflix() async {
    final res = await http.get(Uri.parse('${AppConstants.baseUrl}/netflix/featured'), headers: _headers);
    if (res.statusCode == 200) {
      return jsonDecode(res.body);
    }
    throw Exception('Failed to load Netflix content');
  }

  // --- YouTube ---
  Future<List<dynamic>> getYouTubeVideos() async {
    final res = await http.get(Uri.parse('${AppConstants.baseUrl}/youtube/videos'), headers: _headers);
    if (res.statusCode == 200) {
      return jsonDecode(res.body);
    }
    throw Exception('Failed to load YouTube videos');
  }

  Future<List<dynamic>> getYouTubeShorts() async {
    final res = await http.get(Uri.parse('${AppConstants.baseUrl}/youtube/shorts'), headers: _headers);
    if (res.statusCode == 200) {
      return jsonDecode(res.body);
    }
    throw Exception('Failed to load YouTube Shorts');
  }

  // --- Instagram ---
  Future<List<dynamic>> getInstagramFeed() async {
    final res = await http.get(Uri.parse('${AppConstants.baseUrl}/instagram/feed'), headers: _headers);
    if (res.statusCode == 200) {
      return jsonDecode(res.body);
    }
    throw Exception('Failed to load Instagram feed');
  }

  Future<List<dynamic>> getInstagramStories() async {
    final res = await http.get(Uri.parse('${AppConstants.baseUrl}/instagram/stories'), headers: _headers);
    if (res.statusCode == 200) {
      return jsonDecode(res.body);
    }
    throw Exception('Failed to load Instagram stories');
  }
}
