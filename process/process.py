import json
 
# Opening JSON file
with open('demand_units.geojson', 'r') as region_file, \
    open('baseline_deliveries.json', 'r') as baseline:
 
    # Reading from json file
    region_object = json.load(region_file)
    baseline_object = json.load(baseline)

    for b in baseline_object:
        cop = {}
        i = 1
        for num in baseline_object[b]:
            cop[str(i)] = str(num)
            i += 1
    new_fs = [f for f in region_object["features"] if f["properties"]["DU_ID"] and f["properties"]["DU_ID"] in baseline_object]

    for f in new_fs:
        idd = f["properties"]["DU_ID"]
        f["properties"]["UnmetDemand"] = baseline_object[idd]

    region_object["features"] = new_fs

        
    with open("sample2.json", "w") as outfile:
        json.dump(region_object, outfile)

# with open('baseline_unmetdemand2.json', 'r') as region_file:
#     region_object = json.load(region_file)

#     featureCollectionBaselineUnmetdemand = {
#         "type": 'FeatureCollection',
#         "features": []
#     }

#     for d in region_object:
#         parsed = json.loads(d["1200"])

#         f = {
#             "type": 'Feature',
#             "properties": {
#                 "UnmetDemand": [d[k] for k in d][0:1200],
#             },
#             "geometry": {
#                 "type": parsed["type"],
#                 "coordinates": parsed["coordinates"]
#             }
#         }

#         featureCollectionBaselineUnmetdemand["features"].append(f)

    
#     with open("baseline_unmetdemand_reprocess.json", "w") as outfile:
#         json.dump(featureCollectionBaselineUnmetdemand, outfile)