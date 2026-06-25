import os
import django
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
os.chdir(BASE_DIR)
os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings'
django.setup()

from locations.models import Barangay
from analytics.aggregators import get_barangay_profile
from analytics.scoring import calculate_risk_score
from analytics.prediction import predict_top_hazard

barangays = list(Barangay.objects.all()[:5])
print('BARANGAYS', [(str(b.id), b.name) for b in barangays])

for b in barangays:
    print('---')
    print('BARANGAY', b.id, b.name)
    profile = get_barangay_profile(str(b.id), days=90)
    score = calculate_risk_score(str(b.id), days=90)
    prediction = predict_top_hazard(str(b.id), days=90)
    print('PROFILE', profile)
    print('SCORE', score)
    print('PRED', prediction)
