## Gemini API Integration & Troubleshooting Guide

### Current Gemini API Key
**Key**: `AIzaSyDsYXxNrLpzniaFWzs0Po7W8aXvWq9EBns`

### Where Gemini API is Used

#### 1. **Duplicate Evidence Analysis** (CaseDetails.tsx - `analyzeDuplicateReasons()`)
   - Analyzes why identical evidence appears in multiple cases
   - Returns 4-5 possible reasons for evidence duplication
   - Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent`

#### 2. **Trust Score Explanation** (CaseDetails.tsx - `explainTrustScore()`)
   - Explains why a Trust Score matters for wildlife enforcement
   - Analyzes matching cases to validate detection credibility
   - Endpoint: Same as above

#### 3. **AI Risk Assessment** (CaseDetails.tsx - Main useEffect)
   - Analyzes wildlife trade detection cases
   - Provides risk level, legality concerns, and recommended actions
   - Uses both SDK (`GoogleGenAI`) and REST fallback

---

## Possible Reasons Gemini API Key May Fail

### **Authentication & Configuration Issues**

| Error | Reason | Solution |
|-------|--------|----------|
| **401 Unauthorized** | Invalid or revoked API key | Verify key in Google Cloud Console |
| **403 Forbidden** | API key has restrictions | Remove IP/Referrer restrictions for development |
| **Invalid argument** | API key format is incorrect | Ensure no spaces or special characters |

### **API Enablement Issues**

| Issue | Cause | Fix |
|-------|-------|-----|
| API not enabled | Generative Language API not activated | Enable in Google Cloud Console > APIs |
| Quota exceeded | Monthly free quota exceeded | Upgrade to paid plan or wait for reset |
| API not accessible | Region/account restrictions | Check Google Cloud billing account is active |

### **Request Format Issues**

| Problem | Why it Fails | How to Fix |
|---------|-------------|-----------|
| Empty prompt | Model receives null/undefined text | Validate detection data before API call |
| Malformed JSON | Response parsing fails | Check endpoint URL construction |
| Network timeout | Slow/unstable connection | Use `requestGeminiViaRest` fallback method |

### **Model-Specific Issues**

| Issue | Details | Resolution |
|-------|---------|-----------|
| **gemini-1.5-flash-latest** unavailable | Model deprecated or doesn't exist | Use `gemini-1.5-flash` or `gemini-1.0-pro` |
| Rate limiting | Too many requests too fast | Implement request queuing (current code uses Promise.all) |
| Content filter | Prompt contains restricted content | Avoid sensitive wildlife trade details in initial prompt |

---

## API Connection Points in Code

### 1. **Direct SDK Usage** (CaseDetails.tsx ~line 730)
```typescript
const ai = new GoogleGenAI({ apiKey });
const response = await ai.models.generateContent({
  model: "gemini-1.5-flash-latest",
  contents: prompt,
});
```
**May fail if**: SDK package not installed, API key invalid, model unavailable

### 2. **REST API Fallback** (CaseDetails.tsx ~line 733)
```typescript
const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
const response = await fetch(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
  }),
});
```
**Advantages**: 
- Works without SDK package
- Automatically retries on SDK failure
- Better error visibility

### 3. **Response Parsing** (CaseDetails.tsx ~line 370)
```typescript
const getResponseText = async (response: unknown) => {
  // Handles multiple response formats
  // Extracts text from: string, candidates array, or function result
};
```

---

## Debugging Steps

### Step 1: Verify API Key
```bash
# Check .env file has correct format
cat /workspaces/WILDSCAN/wildscan-enforcement-dashboard/.env
```

### Step 2: Test API Connection
```bash
curl -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"contents": [{"parts": [{"text": "Hello"}]}]}'
```

### Step 3: Check Google Cloud Console
- Project ID verification
- API enablement status
- Quota usage
- Billing account active status

### Step 4: Browser Console Logs
Look for:
- `"Gemini analysis failed:"` errors
- Network tab for failing requests
- CORS errors (should not happen with valid key)

---

## Error Handling in Application

### Current Fallback Mechanism
```typescript
try {
  // Attempt SDK
  const ai = new GoogleGenAI({ apiKey });
  responseText = await ai.models.generateContent({...});
} catch (sdkError) {
  // Fallback to REST
  responseText = await requestGeminiViaRest(apiKey, prompt);
}
```

### If All Fails
- Uses local risk summary fallback
- Displays: `"${localRisk.summary} Gemini verification offline; rely on metadata screening."`
- Application continues to work without AI features

---

## Environment Configuration

**File**: `.env` in `/workspaces/WILDSCAN/wildscan-enforcement-dashboard/`

```dotenv
VITE_GEMINI_API_KEY=AIzaSyDsYXxNrLpzniaFWzs0Po7W8aXvWq9EBns
VITE_GOOGLE_MAPS_API_KEY=AIzaSyDsYXxNrLpzniaFWzs0Po7W8aXvWq9EBns
```

**Loaded via**: Vite environment variables in `import.meta.env`

---

## Performance Notes

- **Duplicate Analysis**: ~2-3 seconds (Gemini AI processing)
- **Trust Score Explanation**: ~1-2 seconds  
- **Main AI Assessment**: Runs on detection change, ~3-5 seconds
- **Timeout**: No explicit timeout; uses browser default (~30-60 seconds)

---

## Security Considerations

⚠️ **WARNING**: Never commit `.env` file with real API keys to public repositories

### Current Implementation
- Keys passed only to authenticated Google endpoints
- No keys stored in localStorage or cookies
- REST endpoint uses HTTPS only
- CORS restrictions apply from Google's side

### Best Practices
1. Use environment-specific keys
2. Rotate keys regularly
3. Monitor usage in Google Cloud Console
4. Set API key restrictions in production
5. Use service accounts for backend services

---

## Related Files Affected

| File | Function | Impact |
|------|----------|--------|
| `.env` | Configuration | Controls API access |
| `CaseDetails.tsx` | Main Gemini integration | Risk analysis, duplicates, trust score |
| `vite-env.d.ts` | TypeScript definitions | Type safety for API key |
| `constants.ts` | App-wide settings | May define fallback behaviors |

