import 'dart:convert';
import 'dart:io';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';

/**
 * PROJECT: WILDSCAN MALAYSIA (2026 Hackathon)
 * ------------------------------------------------------------------
 * OPTIMIZATION: 
 * - Fully Restored Screen 1, 2, and 3 Original UI
 * - Background state extraction for clean Dashboard analytics
 * ------------------------------------------------------------------
 */

class FirebaseOptionsManual {
  static FirebaseOptions get options {
    if (kIsWeb) {
      return const FirebaseOptions(
        apiKey: "AIzaSyCZtsOztWFKY35xZaudyKSGKy13IknU_lw",
        authDomain: "wildscan-487110.firebaseapp.com",
        projectId: "wildscan-487110",
        storageBucket: "wildscan-487110.appspot.com",
        messagingSenderId: "1098649222627",
        appId: "1:1098649222627:web:6c449dd2ecb484f9b274d6",
        measurementId: "G-YSVG71WTEG",
      );
    } else if (Platform.isAndroid) {
      return const FirebaseOptions(
        apiKey: "AIzaSyCZtsOztWFKY35xZaudyKSGKy13IknU_lw",
        appId: "1:1098649222627:android:10fb3e559ead325eb274d6",
        messagingSenderId: "1098649222627",
        projectId: "wildscan-487110",
        storageBucket: "wildscan-487110.appspot.com",
      );
    } else {
      throw UnsupportedError("Platform not supported.");
    }
  }
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: FirebaseOptionsManual.options);
  runApp(const WildScanApp());
}

class WildScanApp extends StatelessWidget {
  const WildScanApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'WILDSCAN',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        scaffoldBackgroundColor: const Color(0xFFEBF5EE),
        primaryColor: const Color(0xFF1B5E20),
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF1B5E20),
          primary: const Color(0xFF121212),
        ),
        useMaterial3: true,
        fontFamily: 'Roboto',
      ),
      home: const MainNavigation(),
    );
  }
}

class MainNavigation extends StatefulWidget {
  const MainNavigation({super.key});

  @override
  _MainNavigationState createState() => _MainNavigationState();
}

class _MainNavigationState extends State<MainNavigation> {
  int _currentIndex = 0;
  
  String selectedWildlife = "Pangolin";
  String otherWildlife = ""; 
  String selectedPlatform = "Facebook Marketplace";
  String otherPlatform = ""; 
  
  XFile? selectedImage; 
  bool _isLoading = false;
  String currentGeneratedId = "WS-0000";
  String reportTime = "";

  String displayLocation = "Determining location...";
  String detectedState = "Unknown State"; // Background variable for analytics
  double? lat;
  double? lng;

  final ImagePicker _picker = ImagePicker();

  // Helper: Extract clean Malaysia State names for the Dashboard
  String _getMalaysiaState(String? raw) {
    if (raw == null || raw.isEmpty) return "Unknown State";
    final states = [
      "Johor", "Kedah", "Kelantan", "Melaka", "Negeri Sembilan", 
      "Pahang", "Perak", "Perlis", "Pulau Pinang", "Sabah", 
      "Sarawak", "Selangor", "Terengganu", "Kuala Lumpur", "Labuan", "Putrajaya"
    ];
    for (var state in states) {
      if (raw.toLowerCase().contains(state.toLowerCase())) return state;
    }
    return "Other";
  }

  // GPS & Reverse Geocoding Logic
  Future<void> _updateLocation() async {
    setState(() => displayLocation = "Searching for GPS signal...");

    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          setState(() => displayLocation = "Permission denied. Tap to retry.");
          return;
        }
      }

      Position position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.best, timeLimit: Duration(seconds: 15)),
      );

      lat = position.latitude;
      lng = position.longitude;
      String coords = "${lat!.toStringAsFixed(4)}, ${lng!.toStringAsFixed(4)}";

      String placeName = "";
      String stateOnly = "Unknown State";
      
      if (kIsWeb) {
        try {
          final url = Uri.parse('https://nominatim.openstreetmap.org/reverse?format=json&lat=$lat&lon=$lng&zoom=10&addressdetails=1');
          final response = await http.get(url);
          if (response.statusCode == 200) {
            final data = json.decode(response.body);
            final addr = data['address'];
            stateOnly = _getMalaysiaState(addr['state'] ?? addr['city'] ?? "");
            placeName = addr['city'] ?? addr['state'] ?? addr['town'] ?? "";
          }
        } catch (e) { debugPrint("Web Geocoding failed: $e"); }
      } else {
        try {
          List<Placemark> placemarks = await placemarkFromCoordinates(lat!, lng!);
          if (placemarks.isNotEmpty) {
            Placemark p = placemarks[0];
            stateOnly = _getMalaysiaState(p.administrativeArea ?? p.locality);
            placeName = "${p.locality ?? p.subAdministrativeArea ?? ''}";
          }
        } catch (e) { debugPrint("Mobile Geocoding failed: $e"); }
      }

      setState(() {
        detectedState = stateOnly; 
        displayLocation = placeName.trim().isEmpty ? coords : "${placeName.trim()} ($coords)";
      });
    } catch (e) {
      setState(() => displayLocation = "Location Timeout. Tap to retry.");
    }
  }

  void _resetApp() {
    setState(() {
      _currentIndex = 0;
      selectedImage = null;
      _isLoading = false;
      selectedWildlife = "Pangolin";
      otherWildlife = "";
      selectedPlatform = "Facebook Marketplace";
      otherPlatform = "";
      displayLocation = "Determining location...";
      detectedState = "Unknown State";
    });
  }

  String _formatCurrentTime() {
    DateTime now = DateTime.now();
    List<String> months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return "${now.day} ${months[now.month - 1]} ${now.year}, ${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')} ${now.hour >= 12 ? 'pm' : 'am'}";
  }

  Future<void> _pickImage(ImageSource source) async {
    try {
      final XFile? image = await _picker.pickImage(source: source);
      if (image != null) {
        setState(() { selectedImage = image; _currentIndex = 1; reportTime = _formatCurrentTime(); });
        _updateLocation();
      }
    } catch (e) { ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Permission Denied"))); }
  }

  Future<void> _pickVideo(ImageSource source) async {
    try {
      final XFile? video = await _picker.pickVideo(source: source, maxDuration: const Duration(minutes: 2));
      if (video != null) {
        setState(() { selectedImage = video; _currentIndex = 1; reportTime = _formatCurrentTime(); });
        _updateLocation();
      }
    } catch (e) { ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Failed to pick video"))); }
  }

  Future<String> _getUniqueCaseId() async {
    final firestore = FirebaseFirestore.instance;
    int counter = 1;
    while (true) {
      String candidateId = "WS-${counter.toString().padLeft(4, '0')}";
      var doc = await firestore.collection("cases").doc(candidateId).get();
      if (!doc.exists) return candidateId;
      counter++;
    }
  }

  Future<String?> _uploadToCloudinary() async {
    if (selectedImage == null) return null;
    const String cloudName = "dqzneohta";
    const String uploadPreset = "wildscan_preset";
    final url = Uri.parse('https://api.cloudinary.com/v1_1/$cloudName/auto/upload');
    try {
      final request = http.MultipartRequest('POST', url)..fields['upload_preset'] = uploadPreset;
      if (kIsWeb) {
        final bytes = await selectedImage!.readAsBytes();
        request.files.add(http.MultipartFile.fromBytes('file', bytes, filename: selectedImage!.name));
      } else {
        request.files.add(await http.MultipartFile.fromPath('file', selectedImage!.path));
      }
      final response = await http.Response.fromStream(await request.send());
      return response.statusCode == 200 ? jsonDecode(response.body)['secure_url'] : null;
    } catch (e) { return null; }
  }

  Future<void> _handleSubmission() async {
    setState(() => _isLoading = true);
    try {
      String uniqueId = await _getUniqueCaseId();
      String numPart = uniqueId.split('-')[1];
      final String? mediaUrl = await _uploadToCloudinary();
      if (mediaUrl == null) throw Exception("Upload failed");

      String finalSpecies = (selectedWildlife == "Others (Please specify)") ? (otherWildlife.isEmpty ? "Unknown Species" : otherWildlife) : selectedWildlife;
      String finalPlatform = (selectedPlatform == "Others (Please specify)") ? (otherPlatform.isEmpty ? "Unknown Platform" : otherPlatform) : selectedPlatform;

      final firestore = FirebaseFirestore.instance;
      final batch = firestore.batch();

      batch.set(firestore.collection("cases").doc(uniqueId), {
        "caseId": uniqueId,
        "speciesDetected": finalSpecies,
        "status": "OPEN",
        "createdAt": FieldValue.serverTimestamp(),
        "reportTime": reportTime,
        "state": detectedState, // Clean state for Dashboard
        "location": {
          "lat": lat ?? 0.0,
          "lng": lng ?? 0.0,
          "fullAddress": displayLocation
        },
      });

      batch.set(firestore.collection("evidence").doc("EV-$numPart"), {
        "evidenceId": "EV-$numPart",
        "caseId": uniqueId,
        "fileUrl": mediaUrl,
        "mediaType": selectedImage!.path.toLowerCase().endsWith('.mp4') ? "video" : "image",
        "platformSource": finalPlatform,
        "uploadedAt": FieldValue.serverTimestamp(),
      });

      await batch.commit();
      setState(() { currentGeneratedId = uniqueId; _isLoading = false; _currentIndex = 2; });
    } catch (e) {
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Submission Error: $e")));
    }
  }

  @override
  Widget build(BuildContext context) {
    final List<Widget> _pages = [
      CameraScreen(onTap: () => _showPickerOptions(context)),
      DetailsScreen(
        image: selectedImage,
        selectedWildlife: selectedWildlife,
        otherWildlife: otherWildlife,
        selectedPlatform: selectedPlatform,
        otherPlatform: otherPlatform,
        reportTime: reportTime,
        displayLocation: displayLocation,
        onWildlifeChanged: (val) => setState(() => selectedWildlife = val!),
        onOtherWildlifeChanged: (val) => setState(() => otherWildlife = val),
        onPlatformChanged: (val) => setState(() => selectedPlatform = val!),
        onOtherPlatformChanged: (val) => setState(() => otherPlatform = val),
        onBack: () => setState(() => _currentIndex = 0),
        onRefreshLocation: _updateLocation,
      ),
      SuccessScreen(onReset: _resetApp, caseId: currentGeneratedId),
    ];

    return Scaffold(
      body: Stack(
        children: [
          SafeArea(child: _pages[_currentIndex]),
          if (_isLoading) Container(color: Colors.black45, child: const Center(child: CircularProgressIndicator(color: Colors.white))),
        ],
      ),
      floatingActionButton: _currentIndex < 2
          ? FloatingActionButton.extended(
              onPressed: () => _currentIndex == 0 ? _showPickerOptions(context) : _handleSubmission(),
              backgroundColor: const Color(0xFF121212),
              label: Row(children: [Text(_currentIndex == 0 ? "Next: Verify Details" : "Submit Report", style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)), const SizedBox(width: 8), const Icon(Icons.arrow_forward_ios, size: 14, color: Colors.white)]),
            )
          : null,
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
    );
  }

  void _showPickerOptions(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(25))),
      builder: (context) => Container(
        padding: const EdgeInsets.symmetric(vertical: 20),
        child: Wrap(
          children: [
            const ListTile(title: Text("Select Evidence Type", style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey))),
            ListTile(leading: const Icon(Icons.camera_alt, color: Color(0xFF1B5E20)), title: const Text('Take a Photo'), onTap: () { Navigator.pop(context); _pickImage(ImageSource.camera); }),
            ListTile(leading: const Icon(Icons.photo_library, color: Color(0xFF1B5E20)), title: const Text('Upload Photo / Screenshot'), onTap: () { Navigator.pop(context); _pickImage(ImageSource.gallery); }),
            const Divider(),
            ListTile(leading: const Icon(Icons.videocam, color: Colors.redAccent), title: const Text('Record Video'), onTap: () { Navigator.pop(context); _pickVideo(ImageSource.camera); }),
            ListTile(leading: const Icon(Icons.video_library, color: Colors.redAccent), title: const Text('Upload Video'), onTap: () { Navigator.pop(context); _pickVideo(ImageSource.gallery); }),
          ],
        ),
      ),
    );
  }
}

// --- SCREEN 1: ORIGINAL CAMERA/UPLOAD UI ---
class CameraScreen extends StatelessWidget {
  final VoidCallback onTap;
  const CameraScreen({super.key, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 30),
          const Text("WILDSCAN", style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900, letterSpacing: -1)),
          const Text("Real-Time Wildlife Crime Detection", style: TextStyle(color: Colors.grey, fontWeight: FontWeight.w500)),
          const SizedBox(height: 40),
          GestureDetector(
            onTap: onTap,
            child: Container(
              width: double.infinity,
              height: 320,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(32),
                boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 20)],
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: const BoxDecoration(color: Color(0xFFC8E6C9), shape: BoxShape.circle),
                    child: const Icon(Icons.cloud_upload_outlined, size: 40, color: Color(0xFF1B5E20)),
                  ),
                  const SizedBox(height: 24),
                  const Text("Capture or Upload Evidence", style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold), textAlign: TextAlign.center),
                  const SizedBox(height: 8),
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 20),
                    child: Text(
                      "Photos or videos of illegal ads, social media listings, chat logs, or physical poaching activity.",
                      style: TextStyle(color: Colors.grey, height: 1.4),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 40),
          _infoRow(Icons.security_rounded, "Anonymous Reporting", "Your identity is encrypted and hidden."),
          const SizedBox(height: 25),
          _infoRow(Icons.verified_user_rounded, "Immutable Proof", "Metadata is preserved for authorities."),
        ],
      ),
    );
  }

  Widget _infoRow(IconData icon, String title, String subtitle) => Row(
        children: [
          Icon(icon, color: const Color(0xFF1B5E20), size: 30),
          const SizedBox(width: 15),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                Text(subtitle, style: const TextStyle(fontSize: 14, color: Colors.grey)),
              ],
            ),
          ),
        ],
      );
}

// --- SCREEN 2: ORIGINAL VERIFICATION UI ---
class DetailsScreen extends StatefulWidget {
  final XFile? image;
  final String selectedWildlife, otherWildlife, selectedPlatform, otherPlatform, reportTime, displayLocation;
  final ValueChanged<String?> onWildlifeChanged, onPlatformChanged;
  final ValueChanged<String> onOtherWildlifeChanged, onOtherPlatformChanged;
  final VoidCallback onBack, onRefreshLocation;

  const DetailsScreen({super.key, required this.image, required this.selectedWildlife, required this.otherWildlife, required this.selectedPlatform, required this.otherPlatform, required this.reportTime, required this.displayLocation, required this.onWildlifeChanged, required this.onOtherWildlifeChanged, required this.onPlatformChanged, required this.onOtherPlatformChanged, required this.onBack, required this.onRefreshLocation});

  @override
  State<DetailsScreen> createState() => _DetailsScreenState();
}

class _DetailsScreenState extends State<DetailsScreen> {
  bool _isEditingLocation = false;
  late TextEditingController _locationController;

  @override
  void initState() { super.initState(); _locationController = TextEditingController(text: widget.displayLocation); }
  @override
  void didUpdateWidget(covariant DetailsScreen oldWidget) { super.didUpdateWidget(oldWidget); if (oldWidget.displayLocation != widget.displayLocation) { setState(() { _locationController.text = widget.displayLocation; }); } }
  @override
  void dispose() { _locationController.dispose(); super.dispose(); }

  bool _isVideo(String path) {
    final lowercasePath = path.toLowerCase();
    return lowercasePath.endsWith('.mp4') || lowercasePath.endsWith('.mov') || lowercasePath.endsWith('.avi');
  }

  void _openZoomPreview(BuildContext context) {
    if (_isVideo(widget.image!.path)) return; 
    showGeneralDialog(
      context: context, barrierDismissible: true, barrierLabel: "Close", barrierColor: Colors.black.withOpacity(0.9),
      pageBuilder: (context, _, __) => Stack(
          children: [
            Center(child: InteractiveViewer(child: kIsWeb ? Image.network(widget.image!.path) : Image.file(File(widget.image!.path)))),
            Positioned(top: 50, right: 20, child: IconButton(icon: const Icon(Icons.close, color: Colors.white), onPressed: () => Navigator.pop(context))),
          ],
        ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(padding: const EdgeInsets.all(10), child: Row(children: [IconButton(icon: const Icon(Icons.arrow_back_ios_new_rounded), onPressed: widget.onBack), const Expanded(child: Center(child: Text("Verify Report Details", style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)))), const SizedBox(width: 48)])),
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 20),
          height: 180, width: double.infinity,
          decoration: BoxDecoration(color: Colors.black, borderRadius: BorderRadius.circular(24), boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10)]),
          child: Stack(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(20),
                child: SizedBox(
                  width: double.infinity, height: double.infinity,
                  child: widget.image == null 
                    ? const Center(child: Icon(Icons.image, color: Colors.grey))
                    : _isVideo(widget.image!.path)
                      ? Container(color: Colors.black87, child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [const Icon(Icons.play_circle_fill, color: Colors.white, size: 50), const SizedBox(height: 8), Text("Video Evidence: ${widget.image!.name}", style: const TextStyle(color: Colors.white70, fontSize: 12))]))
                      : (kIsWeb ? Image.network(widget.image!.path, fit: BoxFit.cover) : Image.file(File(widget.image!.path), fit: BoxFit.cover)),
                ),
              ),
              if (!_isVideo(widget.image?.path ?? ""))
              Positioned(
                right: 12, bottom: 12,
                child: GestureDetector(
                  onTap: () => _openZoomPreview(context), 
                  child: Container(padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: const Color(0xFF1B5E20).withOpacity(0.8), shape: BoxShape.circle), child: const Icon(Icons.fullscreen_rounded, color: Colors.white, size: 24)),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 15),
        Expanded(
          child: Container(
            width: double.infinity, padding: const EdgeInsets.all(24),
            decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(40)), boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 15)]),
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _label("WILDLIFE TYPE"),
                  _dropdown(["Pangolin", "Sun Bear", "Ivory", "Exotic Bird", "Malayan Tiger", "Others (Please specify)"], widget.selectedWildlife, widget.onWildlifeChanged),
                  if (widget.selectedWildlife == "Others (Please specify)") ...[
                    const SizedBox(height: 10),
                    TextField(onChanged: widget.onOtherWildlifeChanged, decoration: _inputDecoration("Enter wildlife name...")),
                  ],
                  const SizedBox(height: 16),
                  _label("PLATFORM DETECTED ON"),
                  _dropdown(["Facebook Marketplace", "Instagram", "Telegram Channel", "WhatsApp Groups", "TikTok", "Twitter/X", "YouTube", "WeChat", "Mudah.my", "Shopee", "Lazada", "Dark Web Forum", "Unknown", "Others (Please specify)"], widget.selectedPlatform, widget.onPlatformChanged),
                  if (widget.selectedPlatform == "Others (Please specify)") ...[
                    const SizedBox(height: 10),
                    TextField(onChanged: widget.onOtherPlatformChanged, decoration: _inputDecoration("Specify platform (e.g. Discord, Red)...")),
                  ],
                  const SizedBox(height: 16),
                  _label("REPORT TIMESTAMP"),
                  _readOnlyField(Icons.access_time_filled, widget.reportTime, "Auto-captured (Immutable)"),
                  const SizedBox(height: 16),
                  _label("LIVE LOCATION"),
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 300),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: const Color(0xFFF8F9FA), borderRadius: BorderRadius.circular(15), border: Border.all(color: _isEditingLocation ? Colors.green : Colors.transparent, width: 1.5)),
                    child: _isEditingLocation 
                      ? Column(children: [TextField(controller: _locationController, style: const TextStyle(fontSize: 13), decoration: InputDecoration(hintText: "Enter location manually...", border: InputBorder.none, suffixIcon: IconButton(icon: const Icon(Icons.check_circle, color: Colors.green), onPressed: () => setState(() => _isEditingLocation = false)))), const Divider(), TextButton.icon(onPressed: () => widget.onRefreshLocation(), icon: const Icon(Icons.refresh, size: 16), label: const Text("Use Current Location (GPS)", style: TextStyle(fontSize: 12)))])
                      : Row(children: [const Icon(Icons.location_on, size: 18, color: Colors.redAccent), const SizedBox(width: 10), Expanded(child: Text(_locationController.text, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13), overflow: TextOverflow.ellipsis)), TextButton(onPressed: () => setState(() => _isEditingLocation = true), child: const Text("✏ Edit", style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)))]),
                  ),
                  const SizedBox(height: 24),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(color: const Color(0xFFF1F8F3), borderRadius: BorderRadius.circular(16)),
                    child: Row(
                      children: [
                        const Icon(Icons.assignment_turned_in_rounded, color: Color(0xFF1B5E20)),
                        const SizedBox(width: 12),
                        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: const [Text("Evidence Metadata Automatically Preserved", style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12)), Text("Media EXIF data and geolocation are securely captured.", style: TextStyle(color: Color(0xFF2E7D32), fontSize: 11))])),
                      ],
                    ),
                  ),
                  const SizedBox(height: 100),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _label(String text) => Padding(padding: const EdgeInsets.only(bottom: 6), child: Text(text, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: Colors.blueGrey)));
  InputDecoration _inputDecoration(String hint) => InputDecoration(hintText: hint, filled: true, fillColor: const Color(0xFFF8F9FA), border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none), contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14));
  Widget _dropdown(List<String> items, String currentVal, ValueChanged<String?> onChanged) => DropdownButtonFormField<String>(value: items.contains(currentVal) ? currentVal : items.first, decoration: _inputDecoration(""), items: items.map((s) => DropdownMenuItem(value: s, child: Text(s, style: const TextStyle(fontSize: 14)))).toList(), onChanged: onChanged);
  Widget _readOnlyField(IconData icon, String val, String sub) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: const Color(0xFFF8F9FA), borderRadius: BorderRadius.circular(12)), child: Row(children: [Icon(icon, size: 18, color: Colors.black45), const SizedBox(width: 10), Expanded(child: Text(val, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)))])), Text(sub, style: const TextStyle(fontSize: 10, color: Colors.grey, fontStyle: FontStyle.italic))]);
}

// --- SCREEN 3: ORIGINAL SUCCESS UI ---
class SuccessScreen extends StatelessWidget {
  final VoidCallback onReset;
  final String caseId;
  const SuccessScreen({super.key, required this.onReset, required this.caseId});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const Spacer(),
        const Icon(Icons.check_circle_rounded, size: 80, color: Color(0xFF81C784)),
        const SizedBox(height: 30),
        const Text("Report Submitted", style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900)),
        Text("Your report has been securely sent to:", style: TextStyle(fontSize: 14, color: Colors.grey.shade700, fontWeight: FontWeight.w500)),
        const Text("PERHILITAN Wildlife Crime Unit", style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF1B5E20))),
        const SizedBox(height: 40),
        Container(
          width: double.infinity, margin: const EdgeInsets.symmetric(horizontal: 20), padding: const EdgeInsets.symmetric(vertical: 32),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 15)]),
          child: Column(children: [const Text("CASE REFERENCE ID", style: TextStyle(fontSize: 10, color: Colors.grey, fontWeight: FontWeight.bold)), const SizedBox(height: 12), Text(caseId, style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w900, letterSpacing: 2))]),
        ),
        const SizedBox(height: 40),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: SizedBox(width: double.infinity, height: 56, child: ElevatedButton.icon(onPressed: onReset, icon: const Icon(Icons.home_filled, color: Colors.white), label: const Text("Submit Another Report", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)), style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1B5E20), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))))),
        ),
        const Spacer(),
        const Text("Thank you for protecting\nMalaysia’s wildlife 🇲🇾", textAlign: TextAlign.center, style: TextStyle(fontSize: 13, color: Colors.grey)),
        const SizedBox(height: 25),
      ],
    );
  }
}