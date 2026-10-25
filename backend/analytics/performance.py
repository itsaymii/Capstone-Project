# analytics/performance.py
from django.db.models import Count, Q
from incidents.models import Incident, ResponderReport, IncidentReport
from django.utils import timezone

def get_response_performance_metrics():
    """
    Calculates responsiveness and performance metrics for emergency response teams.
    Workflow: Citizen calls 911 -> Dispatcher logs Incident (date_reported) -> Responder acts (report_time).
    """
    total_incidents = Incident.objects.count()
    
    # 1. RESOLUTION RATE
    resolved_incidents = Incident.objects.filter(status='resolved').count()
    resolution_rate = round((resolved_incidents / total_incidents * 100), 1) if total_incidents > 0 else 0.0

    # 2. AVERAGE RESPONSE TIME (in minutes)
    # We measure from 'date_reported' (when dispatcher logged the 911 call) 
    # to the first 'ResponderReport' action.
    incidents_with_response = Incident.objects.filter(responder_reports__isnull=False).distinct()
    
    response_times_minutes = []
    for incident in incidents_with_response:
        first_action = incident.responder_reports.order_by('report_time').first()
        if first_action:
            # Calculate time between dispatch logging and responder action
            time_delta = first_action.report_time - incident.date_reported
            minutes = time_delta.total_seconds() / 60
            
            # Ignore negative numbers (in case of bad data entry)
            if minutes >= 0:
                response_times_minutes.append(minutes)
            
    avg_response_time = round(sum(response_times_minutes) / len(response_times_minutes), 1) if response_times_minutes else 0.0

    # 3. TEAM WORKLOAD (Based on official IncidentReport assignments)
    team_workload = IncidentReport.objects.values('responder_team').annotate(
        cases_handled=Count('id')
    ).order_by('-cases_handled')
    
    team_stats = [
        {
            'team': item['responder_team'] or 'Unassigned',
            'cases_handled': item['cases_handled']
        } 
        for item in team_workload
    ]

    # 4. PERFORMANCE BY SEVERITY
    severity_stats = Incident.objects.values('severity_level').annotate(
        total=Count('id'),
        resolved=Count('id', filter=Q(status='resolved'))
    )
    
    severity_breakdown = []
    for item in severity_stats:
        rate = round((item['resolved'] / item['total'] * 100), 1) if item['total'] > 0 else 0.0
        severity_breakdown.append({
            'severity': item['severity_level'],
            'total_incidents': item['total'],
            'resolved': item['resolved'],
            'resolution_rate': rate
        })

    return {
        'overall_metrics': {
            'total_incidents': total_incidents,
            'resolved_incidents': resolved_incidents,
            'resolution_rate_percent': resolution_rate,
            'average_response_time_minutes': avg_response_time,
        },
        'team_workload': team_stats,
        'performance_by_severity': severity_breakdown
    }