import 'dart:convert';

import 'dart:io';



import 'package:cloud_firestore/cloud_firestore.dart';

import 'package:firebase_core/firebase_core.dart';

import 'package:flutter/foundation.dart' show kIsWeb;

import 'package:flutter/material.dart';

import 'package:flutter_svg/svg.dart';

import 'package:geocoding/geocoding.dart';

import 'package:geolocator/geolocator.dart';

import 'package:http/http.dart' as http;

import 'package:image_picker/image_picker.dart';

import 'package:permission_handler/permission_handler.dart';



/**

 * PROJECT: WILDSCAN MALAYSIA (2026 Hackathon)

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

        scaffoldBackgroundColor: const Color(0xFFF1F8E8),

        primaryColor: const Color(0xFFCDE48A),

        colorScheme: ColorScheme.fromSeed(

          seedColor: const Color(0xFFAEDB4F),

          primary: const Color(0xFF121212),

          secondary: const Color(0xFFCDE48A),

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

  String detectedState = "Unknown State";

  double? lat;

  double? lng;

  final ImagePicker _picker = ImagePicker();



  // Mapping coordinates to Malaysia States

  String _getMalaysiaState(String? raw) {

    if (raw == null || raw.isEmpty) return "Unknown State";

    final states = ["Johor", "Kedah", "Kelantan", "Melaka", "Negeri Sembilan", "Pahang", "Perak", "Perlis", "Pulau Pinang", "Sabah", "Sarawak", "Selangor", "Terengganu", "Kuala Lumpur", "Labuan", "Putrajaya"];

    for (var state in states) { if (raw.toLowerCase().contains(state.toLowerCase())) return state; }

    return "Other";

  }



  // Handle GPS and Reverse Geocoding

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

      Position position = await Geolocator.getCurrentPosition(timeLimit: const Duration(seconds: 15));

      lat = position.latitude; lng = position.longitude;

      String coords = "${lat!.toStringAsFixed(4)}, ${lng!.toStringAsFixed(4)}";

      String placeName = ""; String stateOnly = "Unknown State";

     

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

      setState(() { detectedState = stateOnly; displayLocation = placeName.trim().isEmpty ? coords : "${placeName.trim()} ($coords)"; });

    } catch (e) { setState(() => displayLocation = "Location Timeout. Tap to retry."); }

  }



  void _resetApp() {

    setState(() { _currentIndex = 0; selectedImage = null; _isLoading = false; selectedWildlife = "Pangolin"; otherWildlife = ""; selectedPlatform = "Facebook Marketplace"; otherPlatform = ""; displayLocation = "Determining location..."; detectedState = "Unknown State"; });

  }



  String _formatCurrentTime() {

    DateTime now = DateTime.now();

    List<String> months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    return "${now.day} ${months[now.month - 1]} ${now.year}, ${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')} ${now.hour >= 12 ? 'pm' : 'am'}";

  }



  Future<void> _pickImage(ImageSource source) async {

    try {

      final XFile? image = await _picker.pickImage(source: source);

      if (image != null) { setState(() { selectedImage = image; _currentIndex = 1; reportTime = _formatCurrentTime(); }); _updateLocation(); }

    } catch (e) { ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Permission Denied"))); }

  }



  Future<void> _pickVideo(ImageSource source) async {

    try {

      final XFile? video = await _picker.pickVideo(source: source, maxDuration: const Duration(minutes: 2));

      if (video != null) { setState(() { selectedImage = video; _currentIndex = 1; reportTime = _formatCurrentTime(); }); _updateLocation(); }

    } catch (e) { ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Failed to pick video"))); }

  }



  // Generate unique Case ID by checking existing Firestore docs

  Future<String> _getUniqueCaseId() async {

    final firestore = FirebaseFirestore.instance; int counter = 1;

    while (true) {

      String candidateId = "WS-${counter.toString().padLeft(4, '0')}";

      var doc = await firestore.collection("cases").doc(candidateId).get();

      if (!doc.exists) return candidateId; counter++;

    }

  }



  // Handle Cloudinary Upload

  Future<String?> _uploadToCloudinary() async {

    if (selectedImage == null) return null;

    const String cloudName = "dqzneohta"; const String uploadPreset = "wildscan_preset";

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



  // Batch Submit to Firestore

  Future<void> _handleSubmission() async {

    setState(() => _isLoading = true);

    try {

      String uniqueId = await _getUniqueCaseId(); String numPart = uniqueId.split('-')[1];

      final String? mediaUrl = await _uploadToCloudinary();

      if (mediaUrl == null) throw Exception("Upload failed");

      String finalSpecies = (selectedWildlife == "Others (Please specify)") ? (otherWildlife.isEmpty ? "Unknown Species" : otherWildlife) : selectedWildlife;

      String finalPlatform = (selectedPlatform == "Others (Please specify)") ? (otherPlatform.isEmpty ? "Unknown Platform" : otherPlatform) : selectedPlatform;

      final firestore = FirebaseFirestore.instance; final batch = firestore.batch();

      batch.set(firestore.collection("cases").doc(uniqueId), {

        "caseId": uniqueId, "speciesDetected": finalSpecies, "status": "OPEN", "createdAt": FieldValue.serverTimestamp(), "reportTime": reportTime, "state": detectedState,

        "location": { "lat": lat ?? 0.0, "lng": lng ?? 0.0, "fullAddress": displayLocation },

      });

      batch.set(firestore.collection("evidence").doc("EV-$numPart"), {

        "evidenceId": "EV-$numPart", "caseId": uniqueId, "fileUrl": mediaUrl, "mediaType": selectedImage!.path.toLowerCase().endsWith('.mp4') ? "video" : "image", "platformSource": finalPlatform, "uploadedAt": FieldValue.serverTimestamp(),

      });

      await batch.commit();

      setState(() { currentGeneratedId = uniqueId; _isLoading = false; _currentIndex = 2; });

    } catch (e) { setState(() => _isLoading = false); ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Submission Error: $e"))); }

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

          ? Padding(

              padding: const EdgeInsets.symmetric(horizontal: 20),

              child: SizedBox(

                width: double.infinity, height: 65,

                child: FloatingActionButton.extended(

                  elevation: 0,

                  onPressed: () => _currentIndex == 0 ? _showPickerOptions(context) : _handleSubmission(),

                  backgroundColor: const Color(0xFF121212),

                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(100)),

                  label: Row(children: [

                    Text(_currentIndex == 0 ? "Next: Verify Details" : "Submit Report", style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),

                    const SizedBox(width: 8),

                    const Icon(Icons.arrow_forward_rounded, color: Colors.white)

                  ]),

                ),

              ),

            )

          : null,

      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,

    );

  }



  void _showPickerOptions(BuildContext context) {

    showModalBottomSheet(

      context: context,

      backgroundColor: const Color(0xFFF1F8E8),

      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(30))),

      builder: (context) => Container(

        padding: const EdgeInsets.symmetric(vertical: 30, horizontal: 20),

        child: Wrap(

          spacing: 20, runSpacing: 20,

          children: [

            const Text("Select Evidence Type", style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: Color(0xFF121212))),

            _pickerTile(Icons.camera_alt, "Take a Photo", () => _pickImage(ImageSource.camera)),

            _pickerTile(Icons.photo_library, "Upload Photo / Screenshot", () => _pickImage(ImageSource.gallery)),

            _pickerTile(Icons.videocam, "Record Video", () => _pickVideo(ImageSource.camera)),

            _pickerTile(Icons.video_library, "Upload Video", () => _pickVideo(ImageSource.gallery)),

          ],

        ),

      ),

    );

  }



  Widget _pickerTile(IconData icon, String label, VoidCallback onTap) {

    return GestureDetector(

      onTap: () { Navigator.pop(context); onTap(); },

      child: Container(

        width: (MediaQuery.of(context).size.width / 2) - 30,

        padding: const EdgeInsets.all(20),

        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(25)),

        child: Column(

          children: [

            Icon(icon, size: 30, color: const Color(0xFF121212)),

            const SizedBox(height: 10),

            Text(label, textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),

          ],

        ),

      ),

    );

  }

}



// --- SCREEN 1: LANDING / CAMERA SELECTION ---

class CameraScreen extends StatelessWidget {

  final VoidCallback onTap;

  const CameraScreen({super.key, required this.onTap});



  @override

  Widget build(BuildContext context) {

    return SingleChildScrollView(

      child: Padding(

        padding: const EdgeInsets.symmetric(horizontal: 24),

        child: Column(

          crossAxisAlignment: CrossAxisAlignment.start,

          children: [

            const SizedBox(height: 30),

            Row(

              children: [

                SvgPicture.string(

                  '''<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">

                    <circle cx="32" cy="32" r="28" fill="#ffffff" stroke="#1d4ed8" stroke-width="3" />

                    <line x1="32" y1="6" x2="32" y2="14" stroke="#1d4ed8" stroke-width="3" stroke-linecap="round" />

                    <line x1="32" y1="50" x2="32" y2="58" stroke="#1d4ed8" stroke-width="3" stroke-linecap="round" />

                    <line x1="6" y1="32" x2="14" y2="32" stroke="#1d4ed8" stroke-width="3" stroke-linecap="round" />

                    <line x1="50" y1="32" x2="58" y2="32" stroke="#1d4ed8" stroke-width="3" stroke-linecap="round" />

                    <path d="M18 38c2-6 10-11 18-11 8 0 13 3 16 7-2 1-4 1-6 0-3-2-7-2-11 0l-4 2-2 6-5 2c-4 2-9 1-10-6z" fill="#111827" />

                    <path d="M42 26l8-3" stroke="#ef4444" stroke-width="3" stroke-linecap="round" />

                    <line x1="14" y1="50" x2="50" y2="14" stroke="#ef4444" stroke-width="4" stroke-linecap="round" />

                  </svg>''',

                  height: 45,

                ),

                const SizedBox(width: 12),

                const Text("WILDSCAN", style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900, letterSpacing: -1, color: Color(0xFF121212))),

              ],

            ),

            const Text("Real-Time Wildlife Crime Detection", style: TextStyle(color: Colors.grey, fontWeight: FontWeight.w500)),

            const SizedBox(height: 40),

            GestureDetector(

              onTap: onTap,

              child: Container(

                width: double.infinity, padding: const EdgeInsets.all(40),

                decoration: BoxDecoration(color: const Color(0xFFCDE48A), borderRadius: BorderRadius.circular(35)),

                child: Column(

                  children: [

                    Container(

                      padding: const EdgeInsets.all(20), decoration: const BoxDecoration(color: Color(0xFF121212), shape: BoxShape.circle),

                      child: const Icon(Icons.cloud_upload_outlined, size: 40, color: Color(0xFFCDE48A)),

                    ),

                    const SizedBox(height: 24),

                    const Text("Capture or Upload Evidence", style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Color(0xFF121212))),

                    const SizedBox(height: 8),

                    const Text("Photos or videos of illegal ads, social media listings, chat logs, or physical poaching activity.", textAlign: TextAlign.center, style: TextStyle(color: Color(0xFF2D3B1E), fontWeight: FontWeight.w500, height: 1.4)),

                  ],

                ),

              ),

            ),

            const SizedBox(height: 25),

            Row(

              children: [

                Expanded(child: _infoCard("Anonymous Reporting", "Your identity is encrypted and hidden.", Icons.security_rounded)),

                const SizedBox(width: 15),

                Expanded(child: _infoCard("Immutable Proof", "Metadata is preserved for authorities.", Icons.verified_user_rounded)),

              ],

            ),

            const SizedBox(height: 120),

          ],

        ),

      ),

    );

  }



  Widget _infoCard(String title, String sub, IconData icon) {

    return Container(

      padding: const EdgeInsets.all(20), height: 160,

      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(25)),

      child: Column(

        crossAxisAlignment: CrossAxisAlignment.start,

        children: [

          Icon(icon, color: const Color(0xFFAEDB4F), size: 30),

          const Spacer(),

          Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900)),

          const SizedBox(height: 4),

          Text(sub, style: const TextStyle(fontSize: 11, color: Colors.grey)),

        ],

      ),

    );

  }

}



// --- SCREEN 2: DATA VERIFICATION ---

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

  late TextEditingController _locationController;



  @override

  void initState() { super.initState(); _locationController = TextEditingController(text: widget.displayLocation); }

  @override

  void didUpdateWidget(covariant DetailsScreen oldWidget) { super.didUpdateWidget(oldWidget); if (oldWidget.displayLocation != widget.displayLocation) { setState(() { _locationController.text = widget.displayLocation; }); } }

  @override

  void dispose() { _locationController.dispose(); super.dispose(); }



  // Check if file is a video based on extension

  bool _isVideo(String path) {

    final lowercasePath = path.toLowerCase();

    return lowercasePath.endsWith('.mp4') || lowercasePath.endsWith('.mov') || lowercasePath.endsWith('.avi');

  }



  // Show full screen zoom preview for images

  void _openZoomPreview(BuildContext context) {

    if (widget.image == null || _isVideo(widget.image!.path)) return;

    showGeneralDialog(

      context: context,

      barrierDismissible: true,

      barrierLabel: "Close",

      barrierColor: Colors.black.withOpacity(0.9),

      pageBuilder: (context, _, __) => Stack(

        children: [

          Center(child: InteractiveViewer(child: kIsWeb ? Image.network(widget.image!.path) : Image.file(File(widget.image!.path)))),

          Positioned(top: 50, right: 20, child: IconButton(icon: const Icon(Icons.close, color: Colors.white, size: 30), onPressed: () => Navigator.pop(context))),

        ],

      ),

    );

  }



  @override

  Widget build(BuildContext context) {

    return Column(

      children: [

        Padding(

          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 10),

          child: Row(children: [

            IconButton(icon: const Icon(Icons.arrow_back_ios_new_rounded), onPressed: widget.onBack),

            const Expanded(child: Center(child: Text("Verify Report Details", style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)))),

            const SizedBox(width: 48)

          ]),

        ),

       

        // Evidence Media Preview Box

        Container(

          margin: const EdgeInsets.symmetric(horizontal: 20),

          height: 200, width: double.infinity,

          decoration: BoxDecoration(color: const Color(0xFF121212), borderRadius: BorderRadius.circular(30)),

          child: Stack(

            children: [

              ClipRRect(

                borderRadius: BorderRadius.circular(30),

                child: SizedBox(

                  width: double.infinity, height: double.infinity,

                  child: widget.image == null

                      ? const Center(child: Icon(Icons.image, color: Colors.grey))

                      : _isVideo(widget.image!.path)

                          ? Container(

                              color: Colors.black87,

                              child: Column(

                                mainAxisAlignment: MainAxisAlignment.center,

                                children: const [

                                  Icon(Icons.play_circle_fill, color: Color(0xFFCDE48A), size: 60),

                                  SizedBox(height: 8),

                                  Text("Video Evidence", style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold))

                                ],

                              ),

                            )

                          : (kIsWeb ? Image.network(widget.image!.path, fit: BoxFit.cover) : Image.file(File(widget.image!.path), fit: BoxFit.cover)),

                ),

              ),

              // Fullscreen button for images

              if (widget.image != null && !_isVideo(widget.image!.path))

                Positioned(

                  right: 15, bottom: 15,

                  child: GestureDetector(

                    onTap: () => _openZoomPreview(context),

                    child: Container(

                      padding: const EdgeInsets.all(12),

                      decoration: const BoxDecoration(color: Color(0xFFCDE48A), shape: BoxShape.circle),

                      child: const Icon(Icons.fullscreen_rounded, color: Color(0xFF121212), size: 28),

                    ),

                  ),

                ),

            ],

          ),

        ),



        const SizedBox(height: 25),

        Expanded(

          child: SingleChildScrollView(

            padding: const EdgeInsets.symmetric(horizontal: 24),

            child: Column(

              crossAxisAlignment: CrossAxisAlignment.start,

              children: [

                _label("WILDLIFE TYPE"),

                _flatDropdown(["Pangolin", "Sun Bear", "Ivory", "Exotic Bird", "Malayan Tiger", "Others (Please specify)"], widget.selectedWildlife, widget.onWildlifeChanged),

                if (widget.selectedWildlife == "Others (Please specify)") ...[

                  const SizedBox(height: 10),

                  TextField(onChanged: widget.onOtherWildlifeChanged, decoration: _inputDeco("Enter wildlife name...")),

                ],

                const SizedBox(height: 20),

                _label("PLATFORM DETECTED ON"),

                _flatDropdown(["Facebook Marketplace", "Instagram", "Telegram Channel", "WhatsApp Groups", "TikTok", "Twitter/X", "YouTube", "WeChat", "Mudah.my", "Shopee", "Lazada", "Dark Web Forum", "Unknown", "Others (Please specify)"], widget.selectedPlatform, widget.onPlatformChanged),

                if (widget.selectedPlatform == "Others (Please specify)") ...[

                  const SizedBox(height: 10),

                  TextField(onChanged: widget.onOtherPlatformChanged, decoration: _inputDeco("Specify platform...")),

                ],

                const SizedBox(height: 20),

                _label("REPORT TIMESTAMP"),

                _staticField(Icons.access_time_filled, widget.reportTime, "Auto-captured (Immutable)"),

                const SizedBox(height: 20),

                _label("LIVE LOCATION"),

                Container(

                  padding: const EdgeInsets.all(16), decoration: BoxDecoration(color: const Color(0xFFCDE48A), borderRadius: BorderRadius.circular(20)),

                  child: Row(children: [

                    const Icon(Icons.location_on, size: 20),

                    const SizedBox(width: 10),

                    Expanded(child: Text(widget.displayLocation, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13))),

                    IconButton(onPressed: widget.onRefreshLocation, icon: const Icon(Icons.refresh, size: 20))

                  ]),

                ),

                const SizedBox(height: 30),

                _metaBox(),

                const SizedBox(height: 120),

              ],

            ),

          ),

        ),

      ],

    );

  }



  Widget _label(String t) => Padding(padding: const EdgeInsets.only(left: 4, bottom: 8), child: Text(t, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 11, color: Colors.blueGrey)));

 

  Widget _flatDropdown(List<String> items, String val, ValueChanged<String?> onChange) => Container(

    padding: const EdgeInsets.symmetric(horizontal: 16), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)),

    child: DropdownButton<String>(

      value: items.contains(val) ? val : items.first, isExpanded: true, underline: const SizedBox(),

      items: items.map((e) => DropdownMenuItem(value: e, child: Text(e, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)))).toList(),

      onChanged: onChange,

    ),

  );



  InputDecoration _inputDeco(String h) => InputDecoration(hintText: h, filled: true, fillColor: Colors.white, border: OutlineInputBorder(borderRadius: BorderRadius.circular(20), borderSide: BorderSide.none));

 

  Widget _staticField(IconData i, String v, String s) => Container(

    padding: const EdgeInsets.all(16), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)),

    child: Row(children: [Icon(i, size: 20, color: Colors.grey), const SizedBox(width: 12), Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(v, style: const TextStyle(fontWeight: FontWeight.bold)), Text(s, style: const TextStyle(fontSize: 10, color: Colors.grey))])]),

  );



  Widget _metaBox() => Container(

    padding: const EdgeInsets.all(20), decoration: BoxDecoration(color: const Color(0xFF121212), borderRadius: BorderRadius.circular(25)),

    child: Row(children: [

      const Icon(Icons.assignment_turned_in_rounded, color: Color(0xFFCDE48A)),

      const SizedBox(width: 15),

      const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [

        Text("Evidence Metadata Automatically Preserved", style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 12)),

        Text("Media EXIF data and geolocation are securely captured.", style: TextStyle(color: Colors.white60, fontSize: 11))

      ])),

    ]),

  );

}



// --- SCREEN 3: SUBMISSION SUCCESS ---

class SuccessScreen extends StatelessWidget {

  final VoidCallback onReset;

  final String caseId;

  const SuccessScreen({super.key, required this.onReset, required this.caseId});



  @override

  Widget build(BuildContext context) {

    return Padding(

      padding: const EdgeInsets.symmetric(horizontal: 30),

      child: Column(

        mainAxisAlignment: MainAxisAlignment.center,

        children: [

          const Spacer(),

          const Icon(Icons.check_circle_rounded, size: 100, color: Color(0xFF121212)),

          const SizedBox(height: 30),

          const Text("Report Submitted", style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900)),

          const Text("Your report has been securely sent to:", textAlign: TextAlign.center, style: TextStyle(fontSize: 14, color: Colors.grey)),

          const Text("PERHILITAN Wildlife Crime Unit", style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF121212))),

          const SizedBox(height: 40),

          Container(

            width: double.infinity, padding: const EdgeInsets.all(40),

            decoration: BoxDecoration(color: const Color(0xFFCDE48A), borderRadius: BorderRadius.circular(35)),

            child: Column(children: [

              const Text("CASE REFERENCE ID", style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF2D3B1E))),

              const SizedBox(height: 10),

              Text(caseId, style: const TextStyle(fontSize: 36, fontWeight: FontWeight.w900, letterSpacing: 2, color: Color(0xFF121212))),

            ]),

          ),

          const SizedBox(height: 40),

          SizedBox(

            width: double.infinity, height: 65,

            child: ElevatedButton.icon(

              onPressed: onReset, icon: const Icon(Icons.home_filled, color: Colors.white),

              label: const Text("Submit Another Report", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),

              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF121212), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(100))),

            ),

          ),

          const Spacer(),

          const Text("Thank you for protecting\nMalaysia’s wildlife 🇲🇾", textAlign: TextAlign.center, style: TextStyle(fontSize: 13, color: Colors.grey, fontWeight: FontWeight.bold)),

          const SizedBox(height: 30),

        ],

      ),

    );

  }

}