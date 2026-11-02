from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

celery_app = Celery("mdp", broker=settings.REDIS_URL, backend=settings.REDIS_URL,
                    include=["app.services.tasks"])

celery_app.conf.update(
    task_serializer="json", accept_content=["json"], result_serializer="json",
    timezone="Asia/Kolkata", enable_utc=True,
    beat_schedule={
        "fetch-eod-daily": {
            "task": "app.services.tasks.fetch_and_score",
            # TejHQ's primary run starts around 18:30 IST and retries at 21:30.
            # Run at 22:00 IST to collect after the retry window.
            "schedule": crontab(minute=0, hour=22, day_of_week="mon-fri"),
        },
    },
)
