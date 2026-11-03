from django.apps import apps
from django.db.models.signals import post_migrate
from django.dispatch import receiver

from .models import VOLUNTEER_SKILL_CHOICES


@receiver(post_migrate, dispatch_uid='resources.ensure_default_volunteer_skills')
def ensure_default_volunteer_skills(sender, using, **kwargs):
    if sender.name != 'resources':
        return

    VolunteerSkill = apps.get_model('resources', 'VolunteerSkill')
    for code, name in VOLUNTEER_SKILL_CHOICES:
        VolunteerSkill.objects.using(using).get_or_create(
            code=code,
            defaults={'name': name},
        )
