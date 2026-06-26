import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

django.setup()

from incidents.models import IncidentReport
from accounts.models import AccountProfile
from django.db.models import Q

ids = [
    'af8e3244-c1a7-4a62-9a99-1d8f98e1cfde',
    'd6d0569b-472e-4ee0-b5d3-6c6497cde4ce',
    '0dd85d15-8901-4cfc-8314-af2b709974ec',
    '5675ba50-0eaf-4bb8-8e52-803a46d13373',
    'bd4770c7-6d4c-4c15-be81-1db0acf13a49',
    '8ab6c80d-1794-43b6-939c-1fae5740ebe6',
    'd6b97817-e023-4fe0-9f29-062003ebd639',
    '5719902d-4394-4626-962e-4d9595a32097',
]

print('Checking', len(ids), 'report ids...')

found = IncidentReport.objects.filter(id__in=ids)
found_ids = set(str(r.id) for r in found)

for rid in ids:
    print('\n---')
    print('Requested ID:', rid)
    if rid in found_ids:
        r = next(x for x in found if str(x.id) == rid)
        print('Found: True')
        print(' report_code:', r.report_code)
        print(' incident_code:', r.incident_code)
        if r.created_by:
            try:
                role = AccountProfile.objects.filter(user=r.created_by).values_list('role', flat=True).first()
            except Exception:
                role = None
            print(' created_by:', r.created_by.username, ' role:', role)
        else:
            print(' created_by: NULL')
    else:
        # try matching by report_code or incident_code
        by_code = IncidentReport.objects.filter(Q(report_code__iexact=rid) | Q(incident_code__iexact=rid)).first()
        if by_code:
            print('Found by code')
            print(' id:', by_code.id)
            print(' report_code:', by_code.report_code)
            print(' incident_code:', by_code.incident_code)
            if by_code.created_by:
                try:
                    role = AccountProfile.objects.filter(user=by_code.created_by).values_list('role', flat=True).first()
                except Exception:
                    role = None
                print(' created_by:', by_code.created_by.username, ' role:', role)
            else:
                print(' created_by: NULL')
        else:
            print('Found: False')

# Now, count eligible per serializer logic
from django.db.models import Q
query = Q()
query |= Q(id__in=ids)
# also add codes
query |= Q(report_code__in=ids) | Q(incident_code__in=ids)

eligible = IncidentReport.objects.filter(query).exclude(created_by__account_profile__role__in=[AccountProfile.ROLE_ADMIN, AccountProfile.ROLE_STAFF])

print('\nTotal found matching requested identifiers:', found.count())
print('Total eligible after excluding admin/staff:', eligible.count())
print('Eligible IDs:')
for r in eligible:
    print(' -', r.id, '| report_code=', r.report_code, '| incident_code=', r.incident_code)
