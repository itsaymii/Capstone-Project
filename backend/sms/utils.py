# sms/utils.py
import requests
import logging
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
from .models import SMSLog

logger = logging.getLogger(__name__)

def send_critical_alert(phone_number, message, incident=None):
    """
    Sends an SMS using the configured gateway, logs it, and enforces rate limits.
    """
    # 1. Normalize Philippine phone number (09XX to +639XX)
    normalized_phone = phone_number
    if phone_number.startswith("09"):
        normalized_phone = "+63" + phone_number[1:]

    # 2. Normalize the base URL from .env to include scheme if missing
    base_url = (settings.SMS_BASE_URL or '').strip()
    if not base_url:
        logger.error('SMS_BASE_URL is not configured. SMS not sent.')
        SMSLog.objects.create(
            phone_number=phone_number,
            message=message,
            status='failed',
            incident=incident,
        )
        return False

    if not settings.SMS_USERNAME or not settings.SMS_PASSWORD:
        logger.error('SMS_USERNAME or SMS_PASSWORD is not configured. SMS not sent.')
        SMSLog.objects.create(
            phone_number=phone_number,
            message=message,
            status='failed',
            incident=incident,
        )
        return False

    if not base_url.startswith(('http://', 'https://')):
        base_url = f'https://{base_url}'

    normalized_base_url = base_url.rstrip('/')
    if normalized_base_url.lower().endswith('/messages'):
        sms_url = normalized_base_url
    else:
        sms_url = normalized_base_url + '/messages'

    # Mask phone number for secure logging
    masked_phone = f"{phone_number[:4]}****{phone_number[-2:]}" if len(phone_number) > 6 else phone_number

    # 2. Security: Rate limit check (Max 10 messages per day per number)
    day_ago = timezone.now() - timedelta(days=1)
    recent_sms_count = SMSLog.objects.filter(
        phone_number=phone_number,
        send_at__gte=day_ago
    ).count()

    if recent_sms_count >= 10:
        logger.warning(f"Rate limit exceeded for {masked_phone}. SMS not sent.")
        SMSLog.objects.create(
            phone_number=phone_number, 
            message=message, 
            status='rate_limited',
            incident=incident
        )
        return False

    # 3. Send the actual HTTP request to the SMS Gateway
    try:
        res = requests.post(
            sms_url,
            auth=(settings.SMS_USERNAME, settings.SMS_PASSWORD),
            json={
                "textMessage": {"text": message},
                "phoneNumbers": [normalized_phone]
            },
            timeout=16
        )
        
        # 4. Log the result to the database
        if res.status_code in [201, 202]:
            logger.info(f"SMS successfully sent to {masked_phone}")
            SMSLog.objects.create(
                phone_number=phone_number, 
                message=message, 
                status='success',
                incident=incident
            )
            return True
        else:
            logger.error(f"SMS gateway error {res.status_code} for {masked_phone}: {res.text}")
            SMSLog.objects.create(
                phone_number=phone_number, 
                message=message, 
                status='failed',
                incident=incident
            )
            return False
            
    except requests.exceptions.RequestException as e:
        logger.error(f"Network error sending SMS to {masked_phone}: {str(e)}")
        SMSLog.objects.create(
            phone_number=phone_number, 
            message=message, 
            status='failed',
            incident=incident
        )
        return False

# sms/utils.py (Add this below send_critical_alert)
def send_otp_sms(phone_number: str, code: str, purpose: str) -> bool:
    """
    Sends an OTP code via SMS using the configured gateway, logs it, and enforces rate limits.
    """
    # 1. Normalize Philippine phone number
    normalized_phone = phone_number
    if phone_number.startswith("09"):
        normalized_phone = "+63" + phone_number[1:]
    elif phone_number.startswith("9") and len(phone_number) == 10:
        normalized_phone = "+63" + phone_number

    base_url = (settings.SMS_BASE_URL or '').strip()
    if not base_url or not settings.SMS_USERNAME or not settings.SMS_PASSWORD:
        logger.error('SMS gateway settings not configured.')
        return False

    if not base_url.startswith(('http://', 'https://')):
        base_url = f'https://{base_url}'
    
    normalized_base_url = base_url.rstrip('/')
    sms_url = normalized_base_url if normalized_base_url.lower().endswith('/messages') else f"{normalized_base_url}/messages"

    # Mask phone number for secure logging
    masked_phone = f"{phone_number[:4]}****{phone_number[-2:]}" if len(phone_number) > 6 else phone_number

    # 2. Security: Stricter Rate limit check for OTPs (Max 5 per day per number)
    day_ago = timezone.now() - timedelta(days=1)
    recent_sms_count = SMSLog.objects.filter(
        phone_number=phone_number,
        send_at__gte=day_ago
    ).count()

    if recent_sms_count >= 5:
        logger.warning(f"OTP Rate limit exceeded for {masked_phone}. SMS not sent.")
        SMSLog.objects.create(
            phone_number=phone_number, 
            message=f"OTP for {purpose}", 
            status='rate_limited'
        )
        return False

    # 3. Format the OTP message
    message = f"Your DisasterVision OTP code for {purpose} is: {code}. Valid for 3 minutes. Do not share this code."

    # 4. Send the actual HTTP request to the SMS Gateway
    try:
        res = requests.post(
            sms_url,
            auth=(settings.SMS_USERNAME, settings.SMS_PASSWORD),
            json={
                "textMessage": {"text": message},
                "phoneNumbers": [normalized_phone]
            },
            timeout=16
        )
        
        # 5. Log the result to the database
        if res.status_code in [201, 202]:
            logger.info(f"OTP SMS successfully sent to {masked_phone}")
            SMSLog.objects.create(
                phone_number=phone_number, 
                message=message, 
                status='success'
            )
            return True
        else:
            logger.error(f"SMS gateway error {res.status_code} for {masked_phone}: {res.text}")
            SMSLog.objects.create(
                phone_number=phone_number, 
                message=message, 
                status='failed'
            )
            return False
            
    except requests.exceptions.RequestException as e:
        logger.error(f"Network error sending OTP SMS to {masked_phone}: {str(e)}")
        SMSLog.objects.create(
            phone_number=phone_number, 
            message=message, 
            status='failed'
        )
        return False