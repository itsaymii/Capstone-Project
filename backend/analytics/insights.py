"""Generate strategic dashboard briefings using Gemini or a deterministic fallback."""
import json
import logging

from django.conf import settings

try:
    from google import genai
except ImportError:
    genai = None

logger = logging.getLogger(__name__)


def _clean_text(value, field_name, max_length=500):
    if not isinstance(value, str):
        raise ValueError(f'Gemini response field {field_name} must be text.')
    cleaned = ' '.join(value.split())
    if not cleaned or len(cleaned) > max_length:
        raise ValueError(f'Gemini response field {field_name} is empty or too long.')
    return cleaned


def _clean_required_list(value, field_name, minimum, maximum):
    if not isinstance(value, list) or not minimum <= len(value) <= maximum:
        raise ValueError(f'Gemini response field {field_name} has an invalid number of items.')
    return [_clean_text(item, field_name) for item in value]


def _generate_dashboard_gemini_sections(stats):
    from google.genai import types

    client = genai.Client(
        api_key=settings.GEMINI_API_KEY,
        http_options=types.HttpOptions(timeout=20000),
    )
    prompt = f"""
You are preparing a Lucena City DRRMO commander's strategic briefing for the next quarter.
Use only this verified aggregate data from the last 30 days:
{json.dumps(stats, ensure_ascii=False)}

Return one JSON object with exactly these keys:
- "headline": concise title, at most 12 words.
- "summary": 2 or 3 plain sentences describing the observed incident picture.
- "key_findings": 2 or 3 concise factual findings grounded only in the data.
- "recommended_actions": exactly 3 practical strategic actions for the next quarter.

Do not invent trends, causes, percentages, places, or counts. Do not claim a trend over time
because only a single 30-day window is supplied. Do not include markdown or extra keys.
"""
    response = client.models.generate_content(
        model='gemini-2.5-flash-lite',
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.2,
            max_output_tokens=700,
            response_mime_type='application/json',
            thinking_config=types.ThinkingConfig(thinking_budget=0),
        ),
    )
    raw_text = (getattr(response, 'text', '') or '').strip()
    if not raw_text:
        raise ValueError('Gemini returned no briefing content.')
    data = json.loads(raw_text)
    if not isinstance(data, dict) or set(data) != {
        'headline', 'summary', 'key_findings', 'recommended_actions',
    }:
        raise ValueError('Gemini returned an unexpected briefing structure.')

    headline = _clean_text(data['headline'], 'headline', max_length=120)
    if len(headline.split()) > 12:
        raise ValueError('Gemini response headline exceeds 12 words.')

    return {
        'headline': headline,
        'summary': _clean_text(data['summary'], 'summary'),
        'key_findings': _clean_required_list(data['key_findings'], 'key_findings', 2, 3),
        'recommended_actions': _clean_required_list(data['recommended_actions'], 'recommended_actions', 3, 3),
        'source': 'gemini',
    }


def _generate_dashboard_template_sections(stats, source_reason):
    total = stats['total']
    high_critical = stats['high_critical_count']
    hotspots = stats['hotspots']
    hotspot_names = [item['name'] for item in hotspots]
    if total:
        summary = (
            f"{total} incidents were recorded in the 30-day period, averaging "
            f"{stats['monthly_average']} per month. {high_critical} ({stats['high_critical_percentage']}%) "
            "were rated High or Critical."
        )
        hotspot_finding = (
            f"Most frequent hotspots were {', '.join(hotspot_names)}."
            if hotspot_names else 'No incidents in this period were linked to a barangay.'
        )
        findings = [
            f"{total} incidents were recorded; the 30-day monthly average is {stats['monthly_average']}.",
            f"{high_critical} incidents ({stats['high_critical_percentage']}%) were rated High or Critical.",
            hotspot_finding,
        ]
        if high_critical:
            actions = [
                f"Prioritize readiness and response coordination for {', '.join(hotspot_names)}." if hotspot_names
                else 'Review response readiness for the High and Critical incidents recorded.',
                'Review the response capacity available for high-severity incidents.',
                'Track these indicators in the next briefing cycle to identify changes.',
            ]
        else:
            actions = [
                'Maintain standard response readiness across the city.',
                'Continue monitoring incident volume and severity by barangay.',
                'Review these indicators in the next briefing cycle for emerging changes.',
            ]
        headline = 'Strategic incident briefing'
    else:
        summary = 'No incidents were recorded in the 30-day period.'
        findings = [
            'No incidents were recorded in the 30-day period.',
            'No High or Critical incidents were recorded.',
            'No barangay hotspots were identified in this period.',
        ]
        actions = [
            'Maintain standard response readiness across the city.',
            'Continue routine incident reporting and data quality checks.',
            'Review these indicators in the next briefing cycle.',
        ]
        headline = 'No incidents recorded in the last 30 days'

    return {
        'headline': headline,
        'summary': summary,
        'key_findings': findings,
        'recommended_actions': actions,
        'source': 'template',
        'source_reason': source_reason,
    }


def generate_strategic_dashboard_briefing(stats):
    """Generate a validated Gemini briefing, with an explicit deterministic fallback."""
    if genai is None:
        return _generate_dashboard_template_sections(stats, 'sdk_unavailable')
    if not getattr(settings, 'GEMINI_API_KEY', ''):
        return _generate_dashboard_template_sections(stats, 'api_key_not_configured')
    try:
        return _generate_dashboard_gemini_sections(stats)
    except Exception as error:  # noqa: BLE001 - malformed/failed AI output must not break the dashboard
        logger.warning('Gemini dashboard briefing failed; using deterministic template: %s', error)
        return _generate_dashboard_template_sections(stats, 'generation_failed')