import urllib.request, ujson, shapely, h3
from functools import reduce
import math
from PIL import Image

# Opening JSON file
with open("groundwater_hex_med_res_norm.json") as water_file, \
    open("diff_unmet_hex_med_res_norm.json") as difference_scenario_file, \
    open("landuse_hex_med_res_norm.json") as landuse_file:
 
    # Reading from json file
    water_object = ujson.load(water_file)
    difference_scenario_object = ujson.load(difference_scenario_file)
    landuse_object = ujson.load(landuse_file)

    for i, water_res in enumerate(water_object):
        if i < len(difference_scenario_object):
            diff_scen_res = difference_scenario_object[i]
            landuse_res = landuse_object[i]

            for hexId in water_res:
                if hexId in diff_scen_res:
                    water_res[hexId]["UnmetDemand"] = diff_scen_res[hexId]["UnmetDemand"]
                    water_res[hexId]["Difference"] = diff_scen_res[hexId]["Difference"]
                if hexId in landuse_res:
                    water_res[hexId]["LandUse"] = landuse_res[hexId]["LandUse"]
    
    
    with open("combine_hex_med_res_norm.json", "w") as outfile:
        ujson.dump(water_object, outfile)