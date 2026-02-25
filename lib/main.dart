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
import 'package:video_player/video_player.dart';


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

class VideoPreviewer extends StatefulWidget {
  final String videoPath;

  const VideoPreviewer({super.key, required this.videoPath});

  @override
  State<VideoPreviewer> createState() => _VideoPreviewerState();
}

class _VideoPreviewerState extends State<VideoPreviewer> {
  late VideoPlayerController _controller;
  bool _isInitialized = false;

  @override
  void initState() {
    super.initState();
    if (kIsWeb) {
      _controller = VideoPlayerController.networkUrl(Uri.parse(widget.videoPath));
    } else {
      _controller = VideoPlayerController.file(File(widget.videoPath));
    }

    _controller.initialize().then((_) {
      if (mounted) {
        setState(() {
          _isInitialized = true;
          _controller.setLooping(true); 
          _controller.play();          
          _controller.setVolume(0);     
        });
      }
    }).catchError((error) {
      debugPrint("Video initialization failed: $error");
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_isInitialized) {
      return const Center(
        child: CircularProgressIndicator(color: Colors.white),
      );
    }

    return AspectRatio(
      aspectRatio: _controller.value.aspectRatio,
      child: Stack(
        alignment: Alignment.bottomCenter,
        children: [
          VideoPlayer(_controller),
          VideoProgressIndicator(_controller, allowScrubbing: true),
          GestureDetector(
            onTap: () {
              setState(() {
                _controller.value.isPlaying ? _controller.pause() : _controller.play();
              });
            },
            child: Icon(
              _controller.value.isPlaying ? Icons.pause_circle_outline : Icons.play_circle_outline,
              color: Colors.white.withOpacity(0.5),
              size: 50,
            ),
          ),
        ],
      ),
    );
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
  
  String discoveryType = "Online";
  String selectedWildlife = "Pangolin";
  String otherWildlife = "";
  String selectedPlatform = "Facebook Marketplace";
  String otherPlatform = "";
  String onlineLink = "";
  
  XFile? selectedImage;
  bool _isLoading = false;
  String currentGeneratedId = "WS-0000";
  String reportTime = "";
  String displayLocation = "Determining location...";
  String detectedState = "Unknown State";
  double? lat;
  double? lng;
  
  final ImagePicker _picker = ImagePicker();
  final TextEditingController _manualLocationController = TextEditingController();

  String _getMalaysiaState(String? raw) {
  if (raw == null || raw.isEmpty) return "Unknown State";
  String input = raw.toLowerCase();

  final statesMap = {
    "johor": "Johor",
    "kedah": "Kedah",
    "kelantan": "Kelantan",
    "melaka": "Melaka", "malacca": "Melaka",
    "negeri sembilan": "Negeri Sembilan", "n.sembilan": "Negeri Sembilan",
    "pahang": "Pahang",
    "perak": "Perak",
    "perlis": "Perlis",
    "pulau pinang": "Pulau Pinang", "penang": "Pulau Pinang",
    "sabah": "Sabah",
    "sarawak": "Sarawak",
    "selangor": "Selangor",
    "terengganu": "Terengganu",
    "kuala lumpur": "Kuala Lumpur", "kl": "Kuala Lumpur",
    "labuan": "Labuan",
    "putrajaya": "Putrajaya"
  };

  for (var entry in statesMap.entries) {
    if (input.contains(entry.key)) return entry.value;
  }
  return "Other";
}
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
        timeLimit: const Duration(seconds: 15));
    lat = position.latitude;
    lng = position.longitude;

    String fullAddress = "";
    String stateOnly = "Unknown State";

    if (kIsWeb) {
      final url = Uri.parse(
          'https://nominatim.openstreetmap.org/reverse?format=json&lat=$lat&lon=$lng&zoom=18&addressdetails=1');
      final response = await http.get(url, headers: {'User-Agent': 'WildScan_Hackathon'});
      
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final addr = data['address'];
        
        List<String> parts = [
          addr['road'] ?? addr['pedestrian'] ?? '',
          addr['suburb'] ?? addr['neighbourhood'] ?? '',
          addr['postcode'] ?? '',
          addr['city'] ?? addr['town'] ?? addr['village'] ?? '',
          addr['state'] ?? ''
        ];
        fullAddress = parts.where((p) => p.isNotEmpty).join(", ");
        stateOnly = _getMalaysiaState(addr['state'] ?? "");
      }
    } else {
      List<Placemark> placemarks = await placemarkFromCoordinates(lat!, lng!);
      if (placemarks.isNotEmpty) {
        Placemark p = placemarks[0];
        
        fullAddress = "${p.street ?? ''}, ${p.postalCode ?? ''} ${p.locality ?? ''}, ${p.administrativeArea ?? ''}";
        stateOnly = _getMalaysiaState(p.administrativeArea ?? p.locality);
      }
    }

    setState(() {
      detectedState = stateOnly;
      String finalDisplay = fullAddress.trim().isEmpty ? "${lat!.toStringAsFixed(4)}, ${lng!.toStringAsFixed(4)}" : fullAddress;
      
      displayLocation = finalDisplay;
      _manualLocationController.text = finalDisplay;
    });
    
  } catch (e) {
    setState(() => displayLocation = "Location Timeout. Tap to retry.");
    debugPrint("Location Error: $e");
  }
}
  Future<void> _syncCoordinatesFromManualAddress(String address) async {
    if (address.isEmpty) return;
    try {
      if (kIsWeb) {
        final encodedAddr = Uri.encodeComponent(address);
        final url = Uri.parse('https://nominatim.openstreetmap.org/search?q=$encodedAddr&format=json&limit=1');
        final response = await http.get(url, headers: {'User-Agent': 'WildScan_Hackathon'});
        if (response.statusCode == 200) {
          final List data = json.decode(response.body);
          if (data.isNotEmpty) {
            lat = double.parse(data[0]['lat']);
            lng = double.parse(data[0]['lon']);
          }
        }
      } else {
        List<Location> locations = await locationFromAddress(address);
        if (locations.isNotEmpty) {
          lat = locations.first.latitude;
          lng = locations.first.longitude;
        }
      }
    } catch (e) { debugPrint("Manual Geocoding Sync Failed: $e"); }
  }

  Future<void> _handleSubmission() async {
  setState(() {
    _isLoading = true;
    _uploadProgress = 0.0;
  });
  
  try {
    String userTypedAddress = _manualLocationController.text.trim();

    if (discoveryType == "Physical" && userTypedAddress.isNotEmpty) {
      await _syncCoordinatesFromManualAddress(userTypedAddress);
    }

    String parsedState = _getMalaysiaState(userTypedAddress);
    String finalState = (parsedState == "Unknown State" || parsedState == "Other") 
        ? detectedState 
        : parsedState;

    String uniqueId = await _getUniqueCaseId();
    String numPart = uniqueId.split('-')[1];

    final String? mediaUrl = await _uploadToCloudinary();
    if (mediaUrl == null) throw Exception("Media upload failed.");

    String finalSpecies = (selectedWildlife == "Others (Please specify)") 
        ? (otherWildlife.isEmpty ? "Unknown Species" : otherWildlife) 
        : selectedWildlife;
        
    String finalPlatform = (selectedPlatform == "Others (Please specify)") 
        ? (otherPlatform.isEmpty ? "Unknown Platform" : otherPlatform) 
        : selectedPlatform;

    String finalAddressDescription = discoveryType == "Online" 
        ? "[Online Discovery] $userTypedAddress" 
        : userTypedAddress;

    final firestore = FirebaseFirestore.instance;
    final batch = firestore.batch();
    
    batch.set(firestore.collection("cases").doc(uniqueId), {
      "caseId": uniqueId, 
      "speciesDetected": finalSpecies, 
      "status": "OPEN", 
      "createdAt": FieldValue.serverTimestamp(), 
      "reportTime": reportTime, 
      "state": finalState,
      "discoveryType": discoveryType,
      "location": { 
        "lat": lat ?? 0.0, 
        "lng": lng ?? 0.0, 
        "fullAddress": finalAddressDescription 
      },
    });

    batch.set(firestore.collection("evidence").doc("EV-$numPart"), {
      "evidenceId": "EV-$numPart", 
      "caseId": uniqueId, 
      "fileUrl": mediaUrl, 
      "mediaType": selectedImage!.path.toLowerCase().endsWith('.mp4') ? "video" : "image", 
      "platformSource": discoveryType == "Online" ? finalPlatform : "Physical Location",
      "onlineLink": discoveryType == "Online" ? onlineLink : "",
      "uploadedAt": FieldValue.serverTimestamp(),
    });

    await batch.commit();

    setState(() { 
      currentGeneratedId = uniqueId; 
      _isLoading = false; 
      _currentIndex = 2; 
    });

  } catch (e) { 
    setState(() => _isLoading = false); 
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text("Error: $e"), backgroundColor: Colors.redAccent)
    ); 
  }
}
  bool _canSubmit() {
    if (selectedImage == null) return false;
    if (discoveryType == "Online") {
    if (onlineLink.trim().length < 5) return false;
    if (selectedPlatform == "Others (Please specify)" && otherPlatform.trim().isEmpty) return false;
  } else {
    if (_manualLocationController.text.trim().isEmpty) return false;
  }
    if (selectedWildlife == "Others (Please specify)" && otherWildlife.trim().isEmpty) return false;

  return true;
}

  void _resetApp() {
    setState(() { 
      _currentIndex = 0; selectedImage = null; _isLoading = false; 
      selectedWildlife = "Pangolin"; otherWildlife = ""; 
      selectedPlatform = "Facebook Marketplace"; otherPlatform = ""; 
      discoveryType = "Online"; onlineLink = "";
      displayLocation = "Determining location..."; detectedState = "Unknown State"; 
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
    final firestore = FirebaseFirestore.instance; int counter = 1;
    while (true) {
      String candidateId = "WS-${counter.toString().padLeft(4, '0')}";
      var doc = await firestore.collection("cases").doc(candidateId).get();
      if (!doc.exists) return candidateId; counter++;
    }
  }

  double _uploadProgress = 0.0;

Future<String?> _uploadToCloudinary() async {
  if (selectedImage == null) return null;
  
  const String cloudName = "dqzneohta";
  const String uploadPreset = "wildscan_preset";
  final url = Uri.parse('https://api.cloudinary.com/v1_1/$cloudName/auto/upload');

  try {
    List<int> fileBytes;
    String fileName = selectedImage!.name;
    
    if (kIsWeb) {
      fileBytes = await selectedImage!.readAsBytes();
    } else {
      fileBytes = await File(selectedImage!.path).readAsBytes();
    }

    final request = http.MultipartRequest('POST', url)
      ..fields['upload_preset'] = uploadPreset;

    final multipartFile = http.MultipartFile.fromBytes(
      'file', 
      fileBytes, 
      filename: fileName
    );

    final totalByteLength = multipartFile.length;
    request.files.add(multipartFile);

    final httpClient = http.Client();
    final streamedResponse = await httpClient.send(request);

    List<int> responseBytes = [];
    int transferred = 0;

    await for (var chunk in streamedResponse.stream) {
      responseBytes.addAll(chunk);
      transferred += chunk.length;

      setState(() {
        _uploadProgress = transferred / totalByteLength;
      });
    }

    final response = http.Response(
      utf8.decode(responseBytes),
      streamedResponse.statusCode,
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body)['secure_url'];
    }
    return null;
  } catch (e) {
    debugPrint("Upload Error: $e");
    return null;
  }
}

  @override
  Widget build(BuildContext context) {
    final List<Widget> _pages = [
      CameraScreen(onTap: () => _showPickerOptions(context)),
      DetailsScreen(
        image: selectedImage,
        discoveryType: discoveryType,
        selectedWildlife: selectedWildlife,
        otherWildlife: otherWildlife,
        selectedPlatform: selectedPlatform,
        otherPlatform: otherPlatform,
        onlineLink: onlineLink,
        reportTime: reportTime,
        displayLocation: displayLocation,
        manualLocationController: _manualLocationController,
        onDiscoveryTypeChanged: (val) => setState(() => discoveryType = val),
        onWildlifeChanged: (val) => setState(() => selectedWildlife = val!),
        onOtherWildlifeChanged: (val) => setState(() => otherWildlife = val),
        onPlatformChanged: (val) => setState(() => selectedPlatform = val!),
        onOtherPlatformChanged: (val) => setState(() => otherPlatform = val),
        onLinkChanged: (val) => setState(() => onlineLink = val),
        onBack: () => setState(() => _currentIndex = 0),
        onRefreshLocation: _updateLocation,
      ),
      SuccessScreen(onReset: _resetApp, caseId: currentGeneratedId),
    ];

    return Scaffold(
body: Stack(
  children: [
    SafeArea(child: _pages[_currentIndex]),
    if (_isLoading)
      Container(
        color: Colors.black54, 
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(
                value: _uploadProgress > 0 ? _uploadProgress : null, 
                color: const Color(0xFFCDE48A),
                strokeWidth: 5,
              ),
              const SizedBox(height: 20),
              Text(
                "Uploading Evidence: ${(_uploadProgress * 100).toStringAsFixed(0)}%",
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                "Please do not close the app",
                style: TextStyle(color: Colors.white70, fontSize: 12),
              ),
            ],
          ),
        ),
      ),
  ],
),
floatingActionButton: _currentIndex < 2
    ? Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: SizedBox(
          width: double.infinity,
          height: 65,
          child: FloatingActionButton.extended(
            elevation: 0,
            onPressed: () {
              if (_currentIndex == 0) {
                _showPickerOptions(context);
              } else {
                if (!_canSubmit()) {
                  String errorMsg = "Please complete all required fields";
                  if (discoveryType == "Online" && onlineLink.trim().isEmpty) {
                    errorMsg = "Please provide the Online Link/URL";
                  } else if (discoveryType == "Physical" && _manualLocationController.text.trim().isEmpty) {
                    errorMsg = "Please provide a physical address";
                  } else if (selectedWildlife == "Others (Please specify)" && otherWildlife.trim().isEmpty) {
                    errorMsg = "Please specify the wildlife species";
                  }
                  
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(errorMsg), backgroundColor: Colors.redAccent),
                  );
                  return;
                }
                
                _handleSubmission();
              }
            },
            backgroundColor: (_currentIndex == 1 && !_canSubmit())
                ? Colors.grey.shade400
                : const Color(0xFF121212),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(100)),
            label: Row(
              children: [
                Text(
                  _currentIndex == 0 ? "Next: Verify Details" : "Submit Report",
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(width: 8),
                const Icon(Icons.arrow_forward_rounded, color: Colors.white)
              ],
            ),
          ),
        ),
      )
    : null,
    );
  }

  void _showPickerOptions(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFFF1F8E8),
      isScrollControlled: true, 
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(30))),
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.4,
        minChildSize: 0.2, 
        maxChildSize: 0.6, 
        expand: false,
        builder: (context, scrollController) {
          return SingleChildScrollView(
            controller: scrollController, 
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 30, horizontal: 20),
              child: Column( 
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(child: Container(width: 40, height: 5, margin: const EdgeInsets.only(bottom: 20), decoration: BoxDecoration(color: Colors.black12, borderRadius: BorderRadius.circular(10)))),
                  const Text("Select Evidence Type", style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: Color(0xFF121212))),
                  const SizedBox(height: 20),
                  Wrap(
                    spacing: 20, runSpacing: 20,
                    children: [
                      _pickerTile(Icons.camera_alt, "Take a Photo", () => _pickImage(ImageSource.camera)),
                      _pickerTile(Icons.photo_library, "Upload Photo / Screenshot", () => _pickImage(ImageSource.gallery)),
                      _pickerTile(Icons.videocam, "Record Video", () => _pickVideo(ImageSource.camera)),
                      _pickerTile(Icons.video_library, "Upload Video", () => _pickVideo(ImageSource.gallery)),
                    ],
                  ),
                  const SizedBox(height: 30), 
                ],
              ),
            ),
          );
        },
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
            Row(children: [
              SvgPicture.string('''<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="28" fill="#ffffff" stroke="#1d4ed8" stroke-width="3" /><line x1="32" y1="6" x2="32" y2="14" stroke="#1d4ed8" stroke-width="3" stroke-linecap="round" /><line x1="32" y1="50" x2="32" y2="58" stroke="#1d4ed8" stroke-width="3" stroke-linecap="round" /><line x1="6" y1="32" x2="14" y2="32" stroke="#1d4ed8" stroke-width="3" stroke-linecap="round" /><line x1="50" y1="32" x2="58" y2="32" stroke="#1d4ed8" stroke-width="3" stroke-linecap="round" /><path d="M18 38c2-6 10-11 18-11 8 0 13 3 16 7-2 1-4 1-6 0-3-2-7-2-11 0l-4 2-2 6-5 2c-4 2-9 1-10-6z" fill="#111827" /><path d="M42 26l8-3" stroke="#ef4444" stroke-width="3" stroke-linecap="round" /><line x1="14" y1="50" x2="50" y2="14" stroke="#ef4444" stroke-width="4" stroke-linecap="round" /></svg>''', height: 45),
              const SizedBox(width: 12),
              const Text("WILDSCAN", style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900, letterSpacing: -1, color: Color(0xFF121212))),
            ]),
            const Text("Real-Time Wildlife Crime Detection", style: TextStyle(color: Colors.grey, fontWeight: FontWeight.w500)),
            const SizedBox(height: 40),
            GestureDetector(
              onTap: onTap,
              child: Container(
                width: double.infinity, padding: const EdgeInsets.all(40),
                decoration: BoxDecoration(color: const Color(0xFFCDE48A), borderRadius: BorderRadius.circular(35)),
                child: Column(children: [
                  Container(padding: const EdgeInsets.all(20), decoration: const BoxDecoration(color: Color(0xFF121212), shape: BoxShape.circle), child: const Icon(Icons.cloud_upload_outlined, size: 40, color: Color(0xFFCDE48A))),
                  const SizedBox(height: 24),
                  const Text("Capture or Upload Evidence", style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Color(0xFF121212))),
                  const SizedBox(height: 8),
                  const Text("Photos or videos of illegal ads, social media listings, chat logs, or physical poaching activity.", textAlign: TextAlign.center, style: TextStyle(color: Color(0xFF2D3B1E), fontWeight: FontWeight.w500, height: 1.4)),
                ]),
              ),
            ),
            const SizedBox(height: 25),
            Row(children: [
              Expanded(child: _infoCard("Anonymous Reporting", "Your identity is encrypted and hidden.", Icons.security_rounded)),
              const SizedBox(width: 15),
              Expanded(child: _infoCard("Immutable Proof", "Metadata is preserved for authorities.", Icons.verified_user_rounded)),
            ]),
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
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon, color: const Color(0xFFAEDB4F), size: 30),
        const Spacer(),
        Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900)),
        const SizedBox(height: 4),
        Text(sub, style: const TextStyle(fontSize: 11, color: Colors.grey)),
      ]),
    );
  }
}


class DetailsScreen extends StatelessWidget {
  final XFile? image;
  final String discoveryType,
      selectedWildlife,
      otherWildlife,
      selectedPlatform,
      otherPlatform,
      onlineLink,
      reportTime,
      displayLocation;
  final TextEditingController manualLocationController;
  final ValueChanged<String> onDiscoveryTypeChanged,
      onLinkChanged,
      onOtherWildlifeChanged,
      onOtherPlatformChanged;
  final ValueChanged<String?> onWildlifeChanged, onPlatformChanged;
  final VoidCallback onBack, onRefreshLocation;

  const DetailsScreen({
    super.key,
    required this.image,
    required this.discoveryType,
    required this.selectedWildlife,
    required this.otherWildlife,
    required this.selectedPlatform,
    required this.otherPlatform,
    required this.onlineLink,
    required this.reportTime,
    required this.displayLocation,
    required this.manualLocationController,
    required this.onDiscoveryTypeChanged,
    required this.onWildlifeChanged,
    required this.onOtherWildlifeChanged,
    required this.onPlatformChanged,
    required this.onOtherPlatformChanged,
    required this.onLinkChanged,
    required this.onBack,
    required this.onRefreshLocation,
    // Note: onSubmit is removed here because the FloatingActionButton in Parent handles it
  });

  bool _isVideo(String path) =>
      path.toLowerCase().endsWith('.mp4') || path.toLowerCase().endsWith('.mov');

  // Show a simple full-screen dialog to preview the captured media
  void _showFullScreenPreview(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: Colors.black,
        insetPadding: const EdgeInsets.all(10),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (image != null)
              Flexible(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(15),
                  child: _isVideo(image!.path)
                      ? const Center(child: Text("Video Preview", style: TextStyle(color: Colors.white)))
                      : (kIsWeb
                          ? Image.network(image!.path)
                          : Image.file(File(image!.path))),
                ),
              ),
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text("CLOSE", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      // Custom Top App Bar
      Padding(
          padding: const EdgeInsets.all(10),
          child: Row(children: [
            IconButton(
                icon: const Icon(Icons.arrow_back_ios_new_rounded),
                onPressed: onBack),
            const Expanded(
                child: Center(
                    child: Text("Verify Report Details",
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)))),
            const SizedBox(width: 48) // Balancing space
          ])),

      // Media Preview Section
      Container(
        margin: const EdgeInsets.symmetric(horizontal: 20),
        height: 180,
        width: double.infinity,
        decoration: BoxDecoration(
            color: const Color(0xFF121212),
            borderRadius: BorderRadius.circular(30)),
        child: Stack(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(30),
              child: image == null
                  ? const Center(child: Icon(Icons.image, color: Colors.grey))
                  : _isVideo(image!.path)
                      ? const Center(child: Icon(Icons.play_circle_fill, color: Color(0xFFCDE48A), size: 50))
                      : SizedBox.expand(
                          child: kIsWeb
                              ? Image.network(image!.path, fit: BoxFit.cover)
                              : Image.file(File(image!.path), fit: BoxFit.cover)),
            ),
            if (image != null)
              Center(
                child: GestureDetector(
                  onTap: () => _showFullScreenPreview(context),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                    decoration: BoxDecoration(
                        color: Colors.black54,
                        borderRadius: BorderRadius.circular(100),
                        border: Border.all(color: Colors.white24)),
                    child: const Row(mainAxisSize: MainAxisSize.min, children: [
                      Icon(Icons.visibility_rounded, color: Colors.white, size: 18),
                      SizedBox(width: 8),
                      Text("PREVIEW", style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 12)),
                    ]),
                  ),
                ),
              ),
          ],
        ),
      ),

      const SizedBox(height: 20),

      // Scrollable Form Fields
      Expanded(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            _label("WHERE DID YOU DISCOVER THIS?"),
            _buildDiscoveryToggle(),
            
            const SizedBox(height: 20),
            _label("WILDLIFE TYPE"),
            _flatDropdown([
              "Pangolin", "Sun Bear", "Ivory", "Exotic Bird", "Malayan Tiger", "Others (Please specify)"
            ], selectedWildlife, onWildlifeChanged),
            
            if (selectedWildlife == "Others (Please specify)") ...[
              const SizedBox(height: 10),
              TextField(
                  onChanged: onOtherWildlifeChanged,
                  decoration: _inputDeco("Enter wildlife name...")),
            ],

            const SizedBox(height: 20),
            
            // Conditional UI: Online Listing vs Physical Poaching
            if (discoveryType == "Online") ...[
              _label("PLATFORM DETECTED ON"),
              _flatDropdown([
                "Facebook Marketplace", "Instagram", "Telegram Channel", "WhatsApp Groups", 
                "TikTok", "YouTube", "Mudah.my", "Shopee", "Lazada", "Others (Please specify)"
              ], selectedPlatform, onPlatformChanged),
              if (selectedPlatform == "Others (Please specify)") ...[
                const SizedBox(height: 10),
                TextField(
                    onChanged: onOtherPlatformChanged,
                    decoration: _inputDeco("Specify platform...")),
              ],
              const SizedBox(height: 20),
              _label("LINK TO LISTING / PROFILE (REQUIRED)"),
              TextField(
                  onChanged: onLinkChanged,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                  decoration: _inputDeco("Paste URL here...")),
            ] else ...[
              _label("PHYSICAL LOCATION (REQUIRED)"),
              _buildPhysicalLocationSection(),
            ],

            const SizedBox(height: 20),
            _label("REPORT TIMESTAMP"),
            _staticField(Icons.access_time_filled, reportTime),
            
            const SizedBox(height: 20),
            _metaBox(),
            
            const SizedBox(height: 120), // Bottom padding for FloatingActionButton
          ]),
        ),
      ),
    ]);
  }

  // --- UI Components ---

  Widget _buildDiscoveryToggle() => Row(children: [
    _toggleBtn("Online", Icons.language, discoveryType == "Online"),
    const SizedBox(width: 10),
    _toggleBtn("Physical", Icons.location_on, discoveryType == "Physical"),
  ]);

  Widget _toggleBtn(String type, IconData icon, bool isSelected) => Expanded(
    child: GestureDetector(
      onTap: () => onDiscoveryTypeChanged(type),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
            color: isSelected ? const Color(0xFF121212) : Colors.white,
            borderRadius: BorderRadius.circular(15)),
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(icon, size: 18, color: isSelected ? Colors.white : Colors.grey),
          const SizedBox(width: 8),
          Text(type, style: TextStyle(color: isSelected ? Colors.white : Colors.grey, fontWeight: FontWeight.bold)),
        ]),
      ),
    ),
  );

  Widget _buildPhysicalLocationSection() => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: const Color(0xFFCDE48A), 
      borderRadius: BorderRadius.circular(20)
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start, 
      children: [
        Row(children: [
          const Icon(Icons.gps_fixed, size: 18),
          const SizedBox(width: 10),
          const Expanded(
            child: Text("Live Location Data", 
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13))
          ),
          IconButton(onPressed: onRefreshLocation, icon: const Icon(Icons.refresh, size: 20))
        ]),
        const Divider(color: Colors.black12),
        TextField(
            controller: manualLocationController,
            onChanged: (value) {},
            maxLines: null,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900),
            decoration: const InputDecoration(
              hintText: "Edit / Enter address manually...", 
              border: InputBorder.none, 
              icon: Icon(Icons.edit, size: 16)
            )),

        const Padding(
          padding: EdgeInsets.only(top: 8.0, left: 26.0), 
          child: Text(
            "Tip: You can manually edit the address if the GPS is slightly off.",
            style: TextStyle(
              fontSize: 10, 
              color: Color(0xFF4A5D23), 
              fontStyle: FontStyle.italic,
              fontWeight: FontWeight.w500
            ),
          ),
        ),
      ],
    ),
  );

  Widget _label(String t) => Padding(padding: const EdgeInsets.only(left: 4, bottom: 8), child: Text(t, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 11, color: Colors.blueGrey)));

  Widget _flatDropdown(List<String> items, String val, ValueChanged<String?> onChange) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 16),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)),
    child: DropdownButton<String>(
      value: items.contains(val) ? val : items.first,
      isExpanded: true,
      underline: const SizedBox(),
      items: items.map((e) => DropdownMenuItem(value: e, child: Text(e, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)))).toList(),
      onChanged: onChange,
    ),
  );

  InputDecoration _inputDeco(String h) => InputDecoration(
      hintText: h,
      hintStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.grey),
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(20), borderSide: BorderSide.none));

  Widget _staticField(IconData i, String v) => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)),
        child: Row(children: [
          Icon(i, size: 20, color: Colors.grey),
          const SizedBox(width: 12),
          Text(v, style: const TextStyle(fontWeight: FontWeight.bold))
        ]),
      );

  Widget _metaBox() => Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(color: const Color(0xFF121212), borderRadius: BorderRadius.circular(25)),
        child: const Row(children: [
          Icon(Icons.assignment_turned_in_rounded, color: Color(0xFFCDE48A)),
          SizedBox(width: 15),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text("Metadata Automatically Preserved", style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 12)),
                Text("Media EXIF and GPS are securely encrypted.", style: TextStyle(color: Colors.white60, fontSize: 11))
              ])),
        ]),
      );
}

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