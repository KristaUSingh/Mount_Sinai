# LOCATION_PREFIXES.py
# List of the location prefixes 
# (10 Union Square may correspond to several department names.
# i.e. 1176 5th Ave corresponds to 1176 5th Ave RAD MRI and 1176 5th Ave RAD CT.
# This list list basically lists all the location names.) 

LOCATION_PREFIXES = {
    "10 UNION SQ E":[
        "union square",
        "union sq",
        "10 union sq",
        "10 union square"
    ],

    "1090 AMST AVE":[
    ],

    "1176 5TH AVE": [
        "ra",
        "RA",
        "radiology associates"
    ],

    "1470 MADISON AVE": [
        "Hess",
        "HESS",
    ],

    "425 W 59TH ST": [
    ],

    "787 11TH AVE": [
    ],

    "325 W 15TH ST": [
    ],

    "MSQ OP RAD": [
        "Mt Sinai Queens",
        "Queens"
    ],

    "300 CADMAN PLAZA": [
    ],

    "MSM": [
        "Morningside",
        "Mount Sinai Morningside"
    ],

    "MSB": [
    ]
}
