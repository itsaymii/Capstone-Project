# Joins the two migration lines made in parallel: the report-form changes
# (0014 remove fire damage / crime type / weapon, 0015 hospital dropdowns)
# and the severity scoring work (0014 injury severity ... 0017 crime victim details).

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('incidents', '0015_hospital_dropdowns'),
        ('incidents', '0017_crimevictimdetails'),
    ]

    operations = []
