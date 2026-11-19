from django.db import migrations, models


# Older names (typed by hand or from the sample data) and the name now used in the hospital dropdowns.
OLD_HOSPITAL_NAMES = {
    'Mt. Carmel Diocesan General Hospital': 'Mount Carmel Diocesan General Hospital',
    'Lucena United Doctors Hospital': 'Lucena United Doctors Hospital and Medical Center',
    'MMG Hospital and Health Center': 'Lucena MMG General Hospital',
}


def use_dropdown_names(apps, schema_editor):
    MedicalIncidentDetails = apps.get_model('incidents', 'MedicalIncidentDetails')
    AmbulanceIncidentDetails = apps.get_model('incidents', 'AmbulanceIncidentDetails')
    for old, new in OLD_HOSPITAL_NAMES.items():
        MedicalIncidentDetails.objects.filter(hospital=old).update(hospital=new)
        AmbulanceIncidentDetails.objects.filter(destination_hospital=old).update(destination_hospital=new)


class Migration(migrations.Migration):
    """Hospital dropdowns: Stand-by Medical Team gets a hospital field, and old hospital names are aligned."""

    dependencies = [
        ('incidents', '0014_remove_fire_damage_and_crime_type_weapon'),
    ]

    operations = [
        migrations.AddField(
            model_name='standbymedicaldetails',
            name='hospital',
            field=models.CharField(blank=True, max_length=200, null=True),
        ),
        migrations.RunPython(use_dropdown_names, migrations.RunPython.noop),
    ]
