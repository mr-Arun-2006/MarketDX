from celery import Celery
from app.core.config import settings

celery_app = Celery("mdp", broker=settings.REDIS_URL, backend=settings.REDIS_URL,
                    include=["app.services.tasks"])

celery_app.conf.update(
    task_serializer="json", accept_content=["json"], result_serializer="json",
    timezone="Asia/Kolkata", enable_utc=True,
    beat_schedule={
        "fetch-eod-daily": {
            "task": "app.services.tasks.fetch_and_score",
            "schedule": "0 16 * * 1-5",
            "options": {"timezone": "Asia/Kolkata"},
        },
    },
)
