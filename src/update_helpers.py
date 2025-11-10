# -------------------------------------------------------------
# update_helpers.py
# -------------------------------------------------------------
# Purpose:
#   Manage temporary user updates (e.g., marking an exam as
#   unavailable at a site) without touching the main dataset.
# -------------------------------------------------------------

import json
import pandas as pd
from src.data_loader import USER_UPDATES

def disable_exam(exam, site, reason="unspecified"):
    """Temporarily mark an exam unavailable at a site."""
    USER_UPDATES["disabled_exams"].append({
        "exam": exam,
        "site": site,
        "reason": reason,
        "timestamp": pd.Timestamp.now().isoformat()
    })
    with open("data/updates.json", "w") as f:
        json.dump(USER_UPDATES, f, indent=2)
    print(f"✅ Marked {exam} at {site} as unavailable ({reason}).")

def enable_exam(exam, site):
    """Re-enable a previously disabled exam at a site."""
    USER_UPDATES["disabled_exams"] = [
        e for e in USER_UPDATES["disabled_exams"]
        if not (
            e["exam"].lower() == exam.lower()
            and e["site"].lower() == site.lower()
        )
    ]
    with open("data/updates.json", "w") as f:
        json.dump(USER_UPDATES, f, indent=2)
    print(f"✅ Re-enabled {exam} at {site}.")