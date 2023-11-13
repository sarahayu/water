import urllib.request, ujson, shapely, h3
from functools import reduce
import math
from PIL import Image
 
# Opening JSON file
with open("../Baseline_Groundwater.json") as water_file:
 
    # Reading from json file
    water_object = ujson.load(water_file)
    temporal_object = {}

    for f in water_object["features"]:
        idd = f["properties"]["Groundwater"][""]
        if idd not in temporal_object:
            del f["properties"]["Groundwater"][""]
            temporal_object[idd] = f["properties"]["Groundwater"]

    with open("groundwater_temporal.json", "w") as outfile:
        ujson.dump(temporal_object, outfile)