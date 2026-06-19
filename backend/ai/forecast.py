"""
ResQNet — Resource Demand Forecasting
"""


def forecast_resources(
    request_type: str,
    number_of_people: int,
    priority_level: str = 'Medium'
) -> dict:
    """
    Predicts resource requirements based on request parameters.

    Returns a dict with:
        food_packets      — Meal packets needed per day
        water_litres      — Litres of clean water per day
        medical_kits      — First-aid / medicine kits
        rescue_personnel  — Number of rescue workers
        shelter_units     — Temporary shelter units
        duration_days     — Estimated days of support needed
        summary           — Human-readable summary string
    """
    p          = max(1, int(number_of_people))
    multiplier = 1.5 if priority_level == 'High' else 1.0

    forecast = {
        'food_packets':      0,
        'water_litres':      0,
        'medical_kits':      0,
        'rescue_personnel':  0,
        'shelter_units':     0,
        'duration_days':     3,
    }

    if request_type == 'Food':
        forecast['food_packets'] = round(p * 3 * multiplier)   # 3 meals/day
        forecast['water_litres'] = round(p * 2)

    elif request_type == 'Water':
        forecast['water_litres'] = round(p * 5 * multiplier)   # 5 L/person/day
        forecast['food_packets'] = round(p * 1)

    elif request_type == 'Medicine':
        forecast['medical_kits']  = max(1, round(p / 3))
        forecast['water_litres']  = round(p * 2)
        forecast['duration_days'] = 7

    elif request_type == 'Rescue':
        forecast['rescue_personnel'] = max(2, round(p / 2))
        forecast['medical_kits']     = max(1, round(p / 5))
        forecast['food_packets']     = round(p * 2)
        forecast['water_litres']     = round(p * 3)
        forecast['duration_days']    = 1

    elif request_type == 'Shelter':
        forecast['shelter_units'] = max(1, round(p / 5))
        forecast['food_packets']  = round(p * 3)
        forecast['water_litres']  = round(p * 4)
        forecast['duration_days'] = 7

    # Build human-readable summary
    parts = []
    if forecast['rescue_personnel']:
        parts.append(f"{forecast['rescue_personnel']} rescue personnel")
    if forecast['food_packets']:
        parts.append(f"{forecast['food_packets']} meal packets/day")
    if forecast['water_litres']:
        parts.append(f"{forecast['water_litres']}L water/day")
    if forecast['medical_kits']:
        parts.append(f"{forecast['medical_kits']} first-aid kits")
    if forecast['shelter_units']:
        parts.append(f"{forecast['shelter_units']} shelter units")

    forecast['summary'] = ' • '.join(parts) if parts else 'Basic supplies required'
    return forecast
