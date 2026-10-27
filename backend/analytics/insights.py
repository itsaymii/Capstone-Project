# analytics/insights.py
"""
Hazard insights for the Risk Scoring page.

Every insight has the same sections so the page can lay it out for easy reading:

    {
        'headline': one short line,
        'summary': two or three sentences,
        'findings': ['short point', ...],
        'recommendations': ['action to take', ...],
        'stats': {...numbers shown as chips...},
        'source': 'gemini' or 'template',
    }

Gemini writes the sections when an API key is set; otherwise (or when Gemini fails)
a template builds them from the same numbers.
"""
import json
import logging
import time

from django.conf import settings

try:
    from google import genai
except ImportError:
    genai = None

logger = logging.getLogger(__name__)

SEVERITY_LABELS = {
    'critical': 'Critical',
    'high': 'High',
    'moderate': 'Moderate',
    'low': 'Low',
}


def _join_names(names):
    names = [name for name in names if name]
    if len(names) <= 1:
        return ''.join(names)
    return f"{', '.join(names[:-1])} and {names[-1]}"


def _timeframe(days, start_date, end_date):
    """Readable period and its length in months (at least 1)."""
    if start_date and end_date:
        label = f"{start_date.strftime('%B %d, %Y')} to {end_date.strftime('%B %d, %Y')}"
        months = max(1, (end_date - start_date).days / 30)
    else:
        if days <= 30:
            label = 'the past 30 days'
        elif days <= 90:
            label = 'the past 3 months'
        elif days <= 180:
            label = 'the past 6 months'
        else:
            label = 'the past 12 months'
        months = max(1, days / 30)
    return label, months


def _build_stats(stats, days, start_date, end_date):
    total = int(stats.get('total', 0) or 0)
    by_severity = stats.get('by_severity', {}) or {}
    timeframe, months = _timeframe(days, start_date, end_date)
    return {
        'total': total,
        'monthly_average': round(total / months, 1),
        'critical_high': int(by_severity.get('critical', 0) or 0) + int(by_severity.get('high', 0) or 0),
        'by_severity': {SEVERITY_LABELS.get(key, str(key).title()): value for key, value in by_severity.items()},
        'hotspots': list((stats.get('by_barangay', {}) or {}).keys())[:3],
        'timeframe': timeframe,
    }


def format_insight_text(sections):
    """Plain-text version (older clients show ai_insight as text)."""
    lines = [sections['headline'], '', sections['summary']]
    if sections['findings']:
        lines += ['', 'Key findings:'] + [f'• {item}' for item in sections['findings']]
    if sections['recommendations']:
        lines += ['', 'Recommended actions:'] + [f'{index}. {item}' for index, item in enumerate(sections['recommendations'], 1)]
    return '\n'.join(lines)


def generate_hazard_insight_sections(hazard_name, stats, days=365, start_date=None, end_date=None):
    """Insight sections for one hazard; uses Gemini when available, else the template."""
    summary_stats = _build_stats(stats, days, start_date, end_date)

    if genai is not None and getattr(settings, 'GEMINI_API_KEY', ''):
        try:
            sections = _generate_gemini_sections(hazard_name, summary_stats)
            sections['stats'] = summary_stats
            sections['source'] = 'gemini'
            return sections
        except Exception as error:  # noqa: BLE001 - any Gemini failure falls back to the template
            logger.warning('Gemini insight failed, using template: %s', error)

    sections = _generate_template_sections(hazard_name, summary_stats)
    sections['stats'] = summary_stats
    sections['source'] = 'template'
    return sections


def generate_hazard_insight(hazard_name, stats, days=365, start_date=None, end_date=None):
    """Plain-text insight (kept for callers that expect a string)."""
    return format_insight_text(generate_hazard_insight_sections(hazard_name, stats, days, start_date, end_date))


def _clean_list(value, limit):
    if not isinstance(value, list):
        return []
    items = [' '.join(str(item).split()).strip(' -•*') for item in value]
    return [item for item in items if item][:limit]


def _generate_gemini_sections(hazard_name, summary):
    from google.genai import types

    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    severity_text = ', '.join(f'{label}: {count}' for label, count in summary['by_severity'].items()) or 'none recorded'

    prompt = f"""
You are a data analyst for the Lucena City Disaster Risk Reduction and Management Office (DRRMO).

Data for {summary['timeframe']}:
- Hazard / event type: {hazard_name}
- Total incidents: {summary['total']} (about {summary['monthly_average']} per month)
- Severity breakdown: {severity_text}
- Barangays with the most incidents: {_join_names(summary['hotspots']) or 'none'}

Return JSON with exactly these keys:
- "headline": one line, at most 12 words, stating the overall situation.
- "summary": 2 to 3 plain sentences on the situation, risk level, and where incidents concentrate.
- "findings": 2 to 3 short points (one sentence each) taken from the numbers above.
- "recommendations": 3 specific actions for resource allocation or mitigation, each starting with a verb.

Use only the numbers given. No markdown, no headings inside the text, no greetings.
"""

    config = types.GenerateContentConfig(
        temperature=0.2,
        max_output_tokens=700,
        response_mime_type='application/json',
        thinking_config=types.ThinkingConfig(thinking_budget=0),
    )

    last_error = None
    response = None
    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model='gemini-2.5-flash-lite',
                contents=prompt,
                config=config,
            )
            break
        except Exception as error:  # noqa: BLE001
            last_error = error
            logger.warning('Gemini attempt %s/3 failed: %s', attempt + 1, error)
            if attempt < 2:
                time.sleep(2)
    if response is None:
        raise last_error or ValueError('Gemini returned no response.')

    raw_text = (getattr(response, 'text', '') or '').strip()
    if not raw_text:
        raise ValueError('Gemini returned no text.')

    data = json.loads(raw_text)
    sections = {
        'headline': ' '.join(str(data.get('headline', '')).split()),
        'summary': ' '.join(str(data.get('summary', '')).split()),
        'findings': _clean_list(data.get('findings'), 4),
        'recommendations': _clean_list(data.get('recommendations'), 4),
    }
    if not sections['summary'] or not sections['recommendations']:
        raise ValueError('Gemini response is missing the summary or recommendations.')
    if not sections['headline']:
        sections['headline'] = f'{hazard_name} outlook'
    return sections


def _generate_template_sections(hazard_name, summary):
    total = summary['total']
    timeframe = summary['timeframe']
    hotspots = _join_names(summary['hotspots']) or 'no single barangay'

    if total == 0:
        return {
            'headline': f'No {hazard_name} incidents recorded',
            'summary': f'No {hazard_name} incidents were recorded in {timeframe}.',
            'findings': ['There is no incident data for this period.'],
            'recommendations': ['Maintain current preventive measures and keep response teams on standard readiness.'],
        }

    if total > 30:
        level = 'High volume'
        outlook = 'a high volume that needs immediate attention'
        recommendations = [
            f'Prioritize response resources for {hotspots}.',
            'Deploy additional response teams during peak periods.',
            'Run targeted prevention seminars in the hotspot barangays.',
        ]
    elif total > 10:
        level = 'Moderate volume'
        outlook = 'a moderate volume that needs close monitoring'
        recommendations = [
            'Review current response protocols with the teams.',
            f'Conduct routine inspections in {hotspots}.',
            'Track this hazard monthly to catch any increase early.',
        ]
    else:
        level = 'Low volume'
        outlook = 'a low volume, but readiness must be maintained'
        recommendations = [
            'Maintain current operational readiness.',
            'Continue standard community awareness campaigns.',
            f'Keep monitoring {hotspots} for repeat incidents.',
        ]

    findings = [
        f"{total} incidents in {timeframe}, about {summary['monthly_average']} per month.",
        f'Most incidents happened in {hotspots}.' if summary['hotspots'] else 'Incidents are spread across barangays.',
    ]
    if summary['critical_high']:
        findings.append(f"{summary['critical_high']} incidents were rated High or Critical severity.")

    return {
        'headline': f'{level} of {hazard_name} incidents',
        'summary': f'{hazard_name} shows {outlook}, with {total} incidents recorded in {timeframe}. Incidents concentrate in {hotspots}.',
        'findings': findings,
        'recommendations': recommendations,
    }
