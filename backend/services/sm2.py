import datetime


def clamp_quality(quality: int) -> int:
    if quality < 0:
        return 0
    if quality > 5:
        return 5
    return quality


def calculate_sm2(
    repetitions: int,
    interval_days: int,
    ease_factor: float,
    quality: int,
    now: datetime.datetime | None = None,
) -> dict:
    q = clamp_quality(quality)
    reps = max(0, repetitions or 0)
    interval = max(0, interval_days or 0)
    ef = float(ease_factor or 2.5)

    if q >= 3:
        if reps == 0:
            interval = 1
        elif reps == 1:
            interval = 6
        else:
            interval = max(1, round(interval * ef))
        reps += 1
    else:
        reps = 0
        interval = 1

    ef = ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    if ef < 1.3:
        ef = 1.3

    base = now or datetime.datetime.utcnow()
    next_review_date = base + datetime.timedelta(days=interval)

    status = "mastered" if interval >= 21 else "learning"

    return {
        "quality": q,
        "repetitions": reps,
        "interval_days": interval,
        "ease_factor": ef,
        "next_review_date": next_review_date,
        "status": status,
    }
