# analytics/insights.py
from google import genai
from django.conf import settings

def generate_hazard_insight(hazard_name, stats, days=365, start_date=None, end_date=None):
    """
    Generates a comprehensive insight using Google Gemini AI.
    Falls back to template-based generation if API fails.
    """
    try:
        return _generate_gemini_insight(hazard_name, stats, days, start_date, end_date)
    except Exception as e:
        print(f"⚠️  Gemini failed, using fallback: {str(e)}")
        return _generate_template_insight(hazard_name, stats, days, start_date, end_date)


def _generate_gemini_insight(hazard_name, stats, days=365, start_date=None, end_date=None):
    """
    Uses Gemini to generate analytical insights and prints detailed
    debugging information to help diagnose truncation issues.
    """
    from google.genai import types

    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    total = stats.get('total', 0)
    by_severity = stats.get('by_severity', {})
    by_barangay = stats.get('by_barangay', {})

    top_barangays = list(by_barangay.keys())[:3]

    # ✅ DYNAMIC TIMEFRAME CALCULATION (Supports Custom Dates & Rolling Windows)
    if start_date and end_date:
        timeframe = f"{start_date.strftime('%B %d')} to {end_date.strftime('%B %d, %Y')}"
        months = max(1, (end_date - start_date).days / 30)
    else:
        if days <= 30:
            timeframe = "the past 30 days"
        elif days <= 90:
            timeframe = "the past 3 months"
        elif days <= 180:
            timeframe = "the past 6 months"
        else:
            timeframe = "the past 12 months"
        months = max(1, days / 30)

    monthly_avg = total / months

    severity_mapping = {
        'critical': 'Priority 1 (Urgent)',
        'high': 'Priority 2 (High)',
        'moderate': 'Priority 3 (Moderate)',
        'low': 'Priority 4 (Routine)'
    }

    sev_text = ", ".join(
        f"{severity_mapping.get(k, k)}: {v}"
        for k, v in by_severity.items()
    )

    # ✅ UPDATED PROMPT: STRICTLY ONE PARAGRAPH
    prompt = f"""
You are a municipal data analyst for the Lucena City DRRMO.

Analyze the following operational data for {timeframe}:

Hazard/Event Type: {hazard_name}
Total Events: {total} (~{monthly_avg:.1f}/month average)
Priority Breakdown: {sev_text}
Top Focus Areas: {', '.join(top_barangays) if top_barangays else 'None'}

Write EXACTLY ONE SINGLE PARAGRAPH.

Combine a brief summary of the operational situation, risk level, and geographic concentrations with 2-3 specific, actionable recommendations for resource allocation or mitigation. 

Rules:
- STRICTLY ONE PARAGRAPH (no line breaks, no newlines).
- No headings, bullet points, or markdown.
- No salutations or letter formats.
- 120-180 words total.
"""

    safety_settings = [
        types.SafetySetting(
            category=types.HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold=types.HarmBlockThreshold.BLOCK_NONE,
        ),
        types.SafetySetting(
            category=types.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold=types.HarmBlockThreshold.BLOCK_NONE,
        ),
        types.SafetySetting(
            category=types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold=types.HarmBlockThreshold.BLOCK_NONE,
        ),
        types.SafetySetting(
            category=types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold=types.HarmBlockThreshold.BLOCK_NONE,
        ),
    ]

    config = types.GenerateContentConfig(
    temperature=0.2,
    max_output_tokens=250,
    thinking_config=types.ThinkingConfig(
        thinking_budget=0
    ),
    safety_settings=safety_settings
    )

    import time

    last_error = None

    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash-lite",
                contents=prompt,
                config=config
            )
            break

        except Exception as e:
            last_error = e

            print(
                f"Gemini attempt {attempt + 1}/3 failed: {e}"
            )

            if attempt < 2:
                time.sleep(2)

    else:
        raise last_error

    # ==========================
    # DEBUGGING SECTION
    # ==========================

    print("\n========== GEMINI RAW RESPONSE ==========")
    print(response)

    if response.candidates:
        candidate = response.candidates[0]

        print("\n========== FINISH REASON ==========")
        print(candidate.finish_reason)

        print("\n========== SAFETY RATINGS ==========")
        try:
            print(candidate.safety_ratings)
        except Exception:
            pass

        print("\n========== USAGE METADATA ==========")
        try:
            print(response.usage_metadata)
            print(f"\nThought Tokens: " f"{response.usage_metadata.thoughts_token_count}"
    )
            
        except Exception:
            pass

        finish_reason = str(candidate.finish_reason)

        if finish_reason == "FinishReason.SAFETY":
            raise ValueError("Response blocked by safety filters.")

        if finish_reason == "FinishReason.MAX_TOKENS":
            raise ValueError(
                "Gemini response was truncated due to MAX_TOKENS."
            )

        if finish_reason not in [
            "FinishReason.STOP",
            "STOP"
        ]:
            print(
                f"⚠️ Warning: Generation ended with "
                f"{candidate.finish_reason}"
            )

    # ==========================
    # SAFER TEXT EXTRACTION
    # ==========================

    ai_text = ""

    try:
        ai_text = response.text.strip()
    except Exception:
        pass

    if not ai_text:
        try:
            candidate = response.candidates[0]
            ai_text = candidate.content.parts[0].text.strip()
        except Exception:
            raise ValueError("Gemini returned no usable text.")

    print("\n========== GENERATED TEXT ==========")
    print(repr(ai_text))

    # Force remove any accidental newlines the AI might have slipped in
    ai_text = " ".join(ai_text.split())

    # Detect suspiciously short outputs
    if len(ai_text.split()) < 50:
        raise ValueError(
            "Gemini returned an incomplete response."
        )

    return f""" AI-GENERATED INSIGHT: {hazard_name.upper()}

{ai_text}

---
 QUICK STATS:
• Total Incidents: {total}
• Primary Hotspots: {', '.join(top_barangays) if top_barangays else 'N/A'}
"""

def _generate_template_insight(hazard_name, stats, days=365, start_date=None, end_date=None):
    """
    Fallback: Template-based insight generation (no API required).
    """
    total = stats.get('total', 0)
    
    # ✅ DYNAMIC TIMEFRAME CALCULATION (Supports Custom Dates & Rolling Windows)
    if start_date and end_date:
        timeframe = f"{start_date.strftime('%B %d')} to {end_date.strftime('%B %d, %Y')}"
        months = max(1, (end_date - start_date).days / 30)
    else:
        if days <= 30:
            timeframe = "Last 30 Days"
        elif days <= 90:
            timeframe = "Last 3 Months"
        elif days <= 180:
            timeframe = "Last 6 Months"
        else:
            timeframe = "Last 12 Months"
        months = max(1, days / 30)

    monthly_avg = total / months

    if total == 0:
        return f"No {hazard_name} incidents recorded in {timeframe}. Maintain current preventive measures."

    if total > 30:
        trend = "high volume requiring immediate attention"
        recommendation = "prioritize resource allocation, deploy additional response teams, and conduct targeted preventive seminars in hotspot barangays."
    elif total > 10:
        trend = "moderate volume requiring close monitoring"
        recommendation = "review current response protocols and conduct routine inspections in affected barangays."
    else:
        trend = "low volume but readiness must be maintained"
        recommendation = "maintain current operational readiness and continue standard community awareness campaigns."

    top_barangays = list(stats.get('by_barangay', {}).keys())[:3]
    hotspots = ", ".join(top_barangays) if top_barangays else "various locations"

    severity_data = stats.get('by_severity', {})
    critical_high = severity_data.get('critical', 0) + severity_data.get('high', 0)
    
    severity_note = ""
    if critical_high > 0:
        severity_note = f" Of particular concern, {critical_high} incidents were classified as High or Critical severity."

    # ✅ COMBINED INTO ONE SINGLE PARAGRAPH
    return f""" {hazard_name} OVERVIEW ({timeframe}): The data indicates a {trend}, with {total} total incidents recorded (~{monthly_avg:.1f}/month average). Primary hotspots include {hotspots}.{severity_note} To address this, the DRRMO should {recommendation}

---
📈 QUICK STATS:
• Total Incidents: {total}
• Critical/High Severity: {critical_high}
• Timeframe: {timeframe}
• Primary Hotspots: {hotspots}
"""