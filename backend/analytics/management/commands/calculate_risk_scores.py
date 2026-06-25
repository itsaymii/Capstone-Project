# analytics/management/commands/calculate_risk_scores.py
from django.core.management.base import BaseCommand
from django.utils import timezone

from locations.models import Barangay
from analytics.models import BarangayRiskScore, HazardPrediction
from analytics.scoring import calculate_risk_score
from analytics.prediction import predict_top_hazard


class Command(BaseCommand):
    help = 'Calculates and updates risk scores and hazard predictions for all barangays.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days',
            type=int,
            default=90,
            help='Number of days to look back for incident data (default: 90)',
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Delete existing scores and predictions before recalculating.',
        )

    def handle(self, *args, **options):
        days = options['days']
        clear = options['clear']
        
        if clear:
            self.stdout.write(self.style.WARNING('Clearing existing risk scores and predictions...'))
            BarangayRiskScore.objects.all().delete()
            HazardPrediction.objects.all().delete()

        barangays = Barangay.objects.all()
        total = barangays.count()
        
        self.stdout.write(f'Starting batch calculation for {total} barangays (Last {days} days)...')

        for i, brgy in enumerate(barangays, 1):
            try:
                # 1. Calculate Risk Score
                risk_data = calculate_risk_score(str(brgy.id), days=days)
                
                # 2. Calculate Prediction
                pred_data = predict_top_hazard(str(brgy.id), days=days)

                # 3. Save Risk Score to DB
                BarangayRiskScore.objects.update_or_create(
                    barangay=brgy,
                    defaults={
                        'score': risk_data.get('score', 0),
                        'frequency_component': risk_data.get('breakdown', {}).get('frequency', 0),
                        'severity_component': risk_data.get('breakdown', {}).get('severity', 0),
                        'recency_component': risk_data.get('breakdown', {}).get('recency', 0),
                        'algorithm_version': '1.0',  # Added to prevent NOT NULL errors
                        'calculated_at': timezone.now()
                    }
                )

                # 4. Save Prediction to DB
                if pred_data.get('hazard'):
                    HazardPrediction.objects.update_or_create(
                        barangay=brgy,
                        defaults={
                            'hazard_type_id': pred_data.get('hazard_id'),  # ⚠️ See note below
                            'confidence': pred_data.get('confidence', 'Low'),
                            'prediction_window_days': pred_data.get('prediction_window_days', 30),
                            'algorithm_version': '1.0',
                            'generated_at': timezone.now()
                        }
                    )
                
                self.stdout.write(f'[{i}/{total}] Processed {brgy.name}')

            except Exception as e:
                self.stderr.write(self.style.ERROR(f'Error processing {brgy.name}: {str(e)}'))

        self.stdout.write(self.style.SUCCESS('Successfully updated all barangay analytics!'))