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
 * UPDATE: Wildlife Type dropdown now supports "Others (Please specify)"
 * with a dynamic TextField.
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
  String otherWildlife = ""; // Custom input storage
  String selectedPlatform = "Facebook";
  XFile? selectedImage;
  bool _isLoading = false;
  String currentGeneratedId = "WS-0000";
  String reportTime = "";

  String displayLocation = "Determining location...";
  double? lat;
  double? lng;

  final ImagePicker _picker = ImagePicker();

  // CORE: High-accuracy location fetching logic
  Future<void> _updateLocation() async {
    setState(() => displayLocation = "Searching for GPS signal...");

    try {
      // 1. Check & Request permissions
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          setState(() => displayLocation = "Permission denied. Tap to retry.");
          return;
        }
      }

      // 2. Get current position with modern settings
      Position position = await Geolocator.getCurrentPosition(
        locationSettings: AndroidSettings(
          accuracy: LocationAccuracy.best,
          timeLimit: const Duration(seconds: 15),
        ),
      );

      lat = position.latitude;
      lng = position.longitude;
      String coords = "${lat!.toStringAsFixed(4)}, ${lng!.toStringAsFixed(4)}";

      // 3. Reverse Geocoding: Convert coordinates to city name
      String placeName = "";
      if (!kIsWeb) {
        try {
          List<Placemark> placemarks = await placemarkFromCoordinates(lat!, lng!);
          if (placemarks.isNotEmpty) {
            Placemark p = placemarks[0];
            // Combine locality (City) and street or name
            placeName = "${p.locality ?? p.subAdministrativeArea ?? ''} ";
          }
        } catch (e) {
          debugPrint("Geocoding failed: $e");
        }
      }

      // 4. Update the state - This will trigger the child widget to update its TextField
      setState(() {
        displayLocation = placeName.trim().isEmpty ? coords : "${placeName.trim()} ($coords)";
      });

    } catch (e) {
      debugPrint("Location Error: $e");
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
      displayLocation = "Determining location...";
    });
  }

  String _formatCurrentTime() {
    DateTime now = DateTime.now();
    List<String> months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun", 
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];
    return "${now.day} ${months[now.month - 1]} ${now.year}, "
        "${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')} "
        "${now.hour >= 12 ? 'pm' : 'am'}";
  }

  Future<void> _pickImage(ImageSource source) async {
    try {
      final XFile? image = await _picker.pickImage(source: source);
      if (image != null) {
        setState(() {
          selectedImage = image;
          _currentIndex = 1;
          reportTime = _formatCurrentTime();
        });
        _updateLocation();
      }
    } catch (e) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text("Permission Denied")));
    }
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
    final url =
        Uri.parse('https://api.cloudinary.com/v1_1/$cloudName/image/upload');
    try {
      final request = http.MultipartRequest('POST', url)
        ..fields['upload_preset'] = uploadPreset;
      if (kIsWeb) {
        final bytes = await selectedImage!.readAsBytes();
        request.files.add(
            http.MultipartFile.fromBytes('file', bytes, filename: 'upload.jpg'));
      } else {
        request.files
            .add(await http.MultipartFile.fromPath('file', selectedImage!.path));
      }
      final response = await http.Response.fromStream(await request.send());
      return response.statusCode == 200
          ? jsonDecode(response.body)['secure_url']
          : null;
    } catch (e) {
      return null;
    }
  }

  Future<void> _handleSubmission() async {
    setState(() => _isLoading = true);
    try {
      String uniqueId = await _getUniqueCaseId();
      String numPart = uniqueId.split('-')[1];
      final String? imageUrl = await _uploadToCloudinary();
      if (imageUrl == null) throw Exception("Upload failed");

      String finalSpecies = (selectedWildlife == "Others (Please specify)")
          ? (otherWildlife.isEmpty ? "Unknown" : otherWildlife)
          : selectedWildlife;

      final firestore = FirebaseFirestore.instance;
      final batch = firestore.batch();

      batch.set(firestore.collection("cases").doc(uniqueId), {
        "caseId": uniqueId,
        "speciesDetected": finalSpecies,
        "status": "OPEN",
        "createdAt": FieldValue.serverTimestamp(),
        "reportTime": reportTime,
        "location": {
          "lat": lat ?? 0.0,
          "lng": lng ?? 0.0,
          "display": displayLocation
        },
      });

      batch.set(firestore.collection("evidence").doc("EV-$numPart"), {
        "evidenceId": "EV-$numPart",
        "caseId": uniqueId,
        "fileUrl": imageUrl,
        "platformSource": selectedPlatform,
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
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text("Submission Error: $e")));
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
        reportTime: reportTime,
        displayLocation: displayLocation,
        onWildlifeChanged: (val) => setState(() => selectedWildlife = val!),
        onOtherWildlifeChanged: (val) => setState(() => otherWildlife = val),
        onPlatformChanged: (val) => setState(() => selectedPlatform = val!),
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
              color: Colors.black45,
              child: const Center(
                child: CircularProgressIndicator(color: Colors.white),
              ),
            ),
        ],
      ),
      floatingActionButton: _currentIndex < 2
          ? FloatingActionButton.extended(
              onPressed: () => _currentIndex == 0
                  ? _showPickerOptions(context)
                  : _handleSubmission(),
              backgroundColor: const Color(0xFF121212),
              label: Row(
                children: [
                  Text(
                    _currentIndex == 0 ? "Next: Verify Details" : "Submit Report",
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Icon(Icons.arrow_forward_ios, size: 14, color: Colors.white),
                ],
              ),
            )
          : null,
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
    );
  }

  void _showPickerOptions(BuildContext context) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (context) => Wrap(
        children: [
          ListTile(
            leading: const Icon(Icons.camera_alt, color: Color(0xFF1B5E20)),
            title: const Text('Take a Photo'),
            onTap: () {
              Navigator.pop(context);
              _pickImage(ImageSource.camera);
            },
          ),
          ListTile(
            leading: const Icon(Icons.photo_library, color: Color(0xFF1B5E20)),
            title: const Text('Upload from Gallery'),
            onTap: () {
              Navigator.pop(context);
              _pickImage(ImageSource.gallery);
            },
          ),
        ],
      ),
    );
  }
}

// --- SCREEN 1: CAMERA/UPLOAD ---
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
          const Text(
            "WILDSCAN",
            style: TextStyle(
                fontSize: 28, fontWeight: FontWeight.w900, letterSpacing: -1),
          ),
          const Text(
            "Real-Time Wildlife Crime Detection",
            style: TextStyle(color: Colors.grey, fontWeight: FontWeight.w500),
          ),
          const SizedBox(height: 40),
          GestureDetector(
            onTap: onTap,
            child: Container(
              width: double.infinity,
              height: 320,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(32),
                boxShadow: [
                  BoxShadow(
                      color: Colors.black.withOpacity(0.02), blurRadius: 20)
                ],
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: const BoxDecoration(
                        color: Color(0xFFC8E6C9), shape: BoxShape.circle),
                    child: const Icon(Icons.add_a_photo_rounded,
                        size: 40, color: Color(0xFF1B5E20)),
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    "Take Photo or Upload Screenshot",
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                    textAlign: TextAlign.center,
                  ),
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 20),
                    child: Text(
                      "Capture FB posts, Telegram chats, poaching evidence or suspicious ads",
                      style: TextStyle(color: Colors.grey),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 40),
          _infoRow(Icons.security_rounded, "Anonymous Reporting",
              "Your identity is encrypted and hidden."),
          const SizedBox(height: 25),
          _infoRow(Icons.verified_user_rounded, "Immutable Proof",
              "Metadata is preserved for authorities."),
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
                Text(title,
                    style:
                        const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                Text(subtitle,
                    style: const TextStyle(fontSize: 14, color: Colors.grey)),
              ],
            ),
          ),
        ],
      );
}

// --- SCREEN 2: VERIFICATION UI (UPDATED WITH INTERACTIVE LOCATION) ---
class DetailsScreen extends StatefulWidget {
  final XFile? image;
  final String selectedWildlife;
  final String otherWildlife;
  final String selectedPlatform;
  final String reportTime;
  final String displayLocation; // Initial location from GPS
  final ValueChanged<String?> onWildlifeChanged;
  final ValueChanged<String> onOtherWildlifeChanged;
  final ValueChanged<String?> onPlatformChanged;
  final VoidCallback onBack;
  final VoidCallback onRefreshLocation;

  const DetailsScreen({
    super.key,
    required this.image,
    required this.selectedWildlife,
    required this.otherWildlife,
    required this.selectedPlatform,
    required this.reportTime,
    required this.displayLocation,
    required this.onWildlifeChanged,
    required this.onOtherWildlifeChanged,
    required this.onPlatformChanged,
    required this.onBack,
    required this.onRefreshLocation,
  });

  @override
  State<DetailsScreen> createState() => _DetailsScreenState();
}

class _DetailsScreenState extends State<DetailsScreen> {
  bool _isEditingLocation = false;
  late TextEditingController _locationController;

  @override
  void initState() {
    super.initState();
    // Initialize controller with the location passed from parent
    _locationController = TextEditingController(text: widget.displayLocation);
  }

  @override
  void didUpdateWidget(covariant DetailsScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    
    // Logic: If the string from GPS has changed, update the UI's text field
    if (oldWidget.displayLocation != widget.displayLocation) {
      setState(() {
        _locationController.text = widget.displayLocation;
      });
    }
  }

  @override
  void dispose() {
    _locationController.dispose();
    super.dispose();
  }

  // Helper to open the full-screen image preview
  void _openZoomPreview(BuildContext context) {
    showGeneralDialog(
      context: context,
      barrierDismissible: true,
      barrierLabel: "Close",
      barrierColor: Colors.black.withOpacity(0.9),
      pageBuilder: (context, _, __) {
        return Stack(
          children: [
            Center(
              child: InteractiveViewer(
                child: widget.image != null
                    ? (kIsWeb ? Image.network(widget.image!.path) : Image.file(File(widget.image!.path)))
                    : const Icon(Icons.image, color: Colors.white, size: 100),
              ),
            ),
            Positioned(top: 50, right: 20, child: IconButton(icon: const Icon(Icons.close, color: Colors.white), onPressed: () => Navigator.pop(context))),
          ],
         );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Header Row
        Padding(
          padding: const EdgeInsets.all(10),
          child: Row(
            children: [
              IconButton(icon: const Icon(Icons.arrow_back_ios_new_rounded), onPressed: widget.onBack),
              const Expanded(child: Center(child: Text("Verify Report Details", style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)))),
              const SizedBox(width: 48),
            ],
          ),
        ),
        
       // Image Preview Section
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 20),
          height: 180, // Increased height slightly for better visual
          width: double.infinity,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10)
            ],
          ),
          child: Stack(
            children: [
              // 1. The Image (Now static, tapping here does nothing)
              ClipRRect(
                borderRadius: BorderRadius.circular(20),
                child: SizedBox(
                  width: double.infinity,
                  height: double.infinity,
                  child: widget.image != null
                      ? (kIsWeb
                          ? Image.network(widget.image!.path, fit: BoxFit.cover)
                          : Image.file(File(widget.image!.path), fit: BoxFit.cover))
                      : const Center(child: Icon(Icons.image, size: 50, color: Colors.grey)),
                ),
              ),
              
              // 2. The Functional Zoom Button
              Positioned(
                right: 12,
                bottom: 12,
                child: GestureDetector(
                  // ONLY this icon triggers the zoom preview
                  onTap: () => _openZoomPreview(context), 
                  child: Container(
                    padding: const EdgeInsets.all(10), // Larger tap target
                    decoration: BoxDecoration(
                      color: const Color(0xFF1B5E20).withOpacity(0.8), // Use your theme green
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(color: Colors.black.withOpacity(0.2), blurRadius: 4)
                      ],
                    ),
                    child: const Icon(
                      Icons.fullscreen_rounded, // Use fullscreen icon for clearer intent
                      color: Colors.white,
                      size: 24,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        
        const SizedBox(height: 15),

        // Scrollable Form Container
        Expanded(
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(40)),
              boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 15)],
            ),
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Wildlife Dropdown + Custom Field
                  _label("WILDLIFE TYPE"),
                  _dropdown(["Pangolin", "Sun Bear", "Ivory", "Exotic Bird", "Malayan Tiger", "Others (Please specify)"], widget.selectedWildlife, widget.onWildlifeChanged),
                  if (widget.selectedWildlife == "Others (Please specify)") ...[
                    const SizedBox(height: 10),
                    TextField(
                      onChanged: widget.onOtherWildlifeChanged,
                      decoration: _inputDecoration("Enter wildlife name..."),
                    ),
                  ],

                  const SizedBox(height: 16),
                  _label("PLATFORM DETECTED ON"),
                  _dropdown(["Facebook", "Telegram", "WhatsApp", "Mudah.my", "Physical Store"], widget.selectedPlatform, widget.onPlatformChanged),

                  const SizedBox(height: 16),
                  _label("REPORT TIMESTAMP"),
                  _readOnlyField(Icons.access_time_filled, widget.reportTime, "Auto-captured (Immutable)"),

                  const SizedBox(height: 16),
                  
                  // --- START: INTEGRATED LOCATION PICKER UI ---
                  _label("LIVE LOCATION"),
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 300),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8F9FA),
                      borderRadius: BorderRadius.circular(15),
                      border: Border.all(color: _isEditingLocation ? Colors.green : Colors.transparent, width: 1.5),
                    ),
                    child: _isEditingLocation ? _buildEditLocationUI() : _buildDisplayLocationUI(),
                  ),
                  // --- END: INTEGRATED LOCATION PICKER UI ---

                  const SizedBox(height: 24),
                  
                  // Metadata Info Box
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(color: const Color(0xFFF1F8F3), borderRadius: BorderRadius.circular(16)),
                    child: Row(
                      children: [
                        const Icon(Icons.assignment_turned_in_rounded, color: Color(0xFF1B5E20)),
                        const SizedBox(width: 12),
                        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: const [
                          Text("Evidence Metadata Automatically Preserved", style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12)),
                          Text("Image EXIF data and geolocation are securely captured.", style: TextStyle(color: Color(0xFF2E7D32), fontSize: 11)),
                        ])),
                      ],
                    ),
                  ),
                  const SizedBox(height: 100), // Padding for Floating Action Button
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  // Sub-widget: Shows location when not editing
  Widget _buildDisplayLocationUI() {
    return Row(
      children: [
        const Icon(Icons.location_on, size: 18, color: Colors.redAccent),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            _locationController.text,
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
            overflow: TextOverflow.ellipsis,
          ),
        ),
        TextButton(
          onPressed: () => setState(() => _isEditingLocation = true),
          child: const Text("✏ Edit", style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
        ),
      ],
    );
  }

  // Sub-widget: Shows TextField and Refresh button when editing
  Widget _buildEditLocationUI() {
    return Column(
      children: [
        TextField(
          controller: _locationController,
          style: const TextStyle(fontSize: 13),
          decoration: InputDecoration(
            hintText: "Enter location manually...",
            border: InputBorder.none,
            suffixIcon: IconButton(
              icon: const Icon(Icons.check_circle, color: Colors.green),
              onPressed: () => setState(() => _isEditingLocation = false),
            ),
          ),
        ),
        const Divider(),
        TextButton.icon(
          onPressed: () {
            widget.onRefreshLocation(); // Trigger GPS update in parent
            // Not closing edit mode immediately so user sees the update
          },
          icon: const Icon(Icons.refresh, size: 16),
          label: const Text("Use Current Location (GPS)", style: TextStyle(fontSize: 12)),
        ),
      ],
    );
  }

  // Helper UI Styles
  Widget _label(String text) => Padding(padding: const EdgeInsets.only(bottom: 6), child: Text(text, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: Colors.blueGrey)));

  InputDecoration _inputDecoration(String hint) => InputDecoration(
    hintText: hint, filled: true, fillColor: const Color(0xFFF8F9FA),
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
  );

  Widget _dropdown(List<String> items, String currentVal, ValueChanged<String?> onChanged) => DropdownButtonFormField<String>(
    value: items.contains(currentVal) ? currentVal : items.first,
    decoration: _inputDecoration(""),
    items: items.map((s) => DropdownMenuItem(value: s, child: Text(s, style: const TextStyle(fontSize: 14)))).toList(),
    onChanged: onChanged,
  );

  Widget _readOnlyField(IconData icon, String val, String sub) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: const Color(0xFFF8F9FA), borderRadius: BorderRadius.circular(12)),
        child: Row(children: [Icon(icon, size: 18, color: Colors.black45), const SizedBox(width: 10), Expanded(child: Text(val, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)))]),
      ),
      Text(sub, style: const TextStyle(fontSize: 10, color: Colors.grey, fontStyle: FontStyle.italic)),
    ],
  );
}

// --- SCREEN 3: SUCCESS ---
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
        const Text(
          "Report Submitted",
          style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900),
        ),
        Text(
          "Your report has been securely sent to:",
          style: TextStyle(
              fontSize: 14,
              color: Colors.grey.shade700,
              fontWeight: FontWeight.w500),
        ),
        const Text(
          "PERHILITAN Wildlife Crime Unit",
          style: TextStyle(
              fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF1B5E20)),
        ),
        const SizedBox(height: 40),
        Container(
          width: double.infinity,
          margin: const EdgeInsets.symmetric(horizontal: 20),
          padding: const EdgeInsets.symmetric(vertical: 32),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 15)
            ],
          ),
          child: Column(
            children: [
              const Text(
                "CASE REFERENCE ID",
                style: TextStyle(
                    fontSize: 10, color: Colors.grey, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              Text(
                caseId,
                style: const TextStyle(
                    fontSize: 32, fontWeight: FontWeight.w900, letterSpacing: 2),
              ),
            ],
          ),
        ),
        const SizedBox(height: 40),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: SizedBox(
            width: double.infinity,
            height: 56,
            child: ElevatedButton.icon(
              onPressed: onReset,
              icon: const Icon(Icons.home_filled, color: Colors.white),
              label: const Text(
                "Submit Another Report",
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1B5E20),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
        ),
        const Spacer(),
        const Text(
          "Thank you for protecting\nMalaysia’s wildlife 🇲🇾",
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 13, color: Colors.grey),
        ),
        const SizedBox(height: 25),
      ],
    );
  }
}