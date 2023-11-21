import urllib.request, ujson, shapely, h3
from functools import reduce
import math
import area
from PIL import Image
import random

random.seed(10)

def latlngToMerc(lat, lon):
    z = 5

    latRad = lat * 3.141593 / 180
    n = pow(2, z)
    xTile = n * ((lon + 180) / 360)
    yTile = n * (1-(math.log(math.tan(latRad) + 1 / math.cos(latRad)) / 3.141593)) / 2

    return xTile - math.floor(xTile), yTile - math.floor(yTile)

# function avg(arr) {
#   return arr.reduce((a, b) => a + b) / arr.length
# }

def avg(arr): 
    if len(arr) == 0:
        return 0
    return reduce(lambda a, b: a + b, arr) / len(arr) 


# const avgArrOfArr = arr => {
#     let avgArr = []

#     for (let j = 0; j < arr[0].length; j++) {
#         avgArr.push(arr.map(a => Number(a[j])).reduce((a, b) => (a + b)) / arr.length)
#     }

#     return avgArr
# }

def avgArrOfArr(arr):
    
    avgArr = []

    if len(arr) != 0:
        for j in range(0, len(arr[0])):
            if j != 1201:
                # print(j)
                avgArr.append(avg([float(a[j]) for a in arr]))

    return avgArr


# function avgObject(arrObjs) {  
#   let avgObj = {}

#   let propsToAvg = Object.keys(arrObjs[0] || {})

#   // avgObj[propsToAvg[0]] = noise.simplex2(centerLat * 10, centerLng *10);
#   // avgObj[propsToAvg[1]] = noise2.simplex2(centerLat * 10, centerLng *10);

#   propsToAvg.forEach(propToAvg => {
#     avgObj[propToAvg] = avg(arrObjs.map(hexPoint => hexPoint[propToAvg]))
#     // avgObj[propToAvg] = value / 2 + 0.5
#   })

#   return avgObj
# }

def avgObject(arrObjs):
    return {
        "confidence": avg([ obj["confidence"] for obj in arrObjs]),
        "power": avg([ float(obj["power"]) for obj in arrObjs]),
    }

# function flatten(arr) {  
#   return [].concat.apply([], arr)
# }

# https://stackoverflow.com/a/952952
def flatten(arr):
    return [[float(i) for i in item] for sublist in arr for item in sublist]

# /**
#  * 
#  * returns array of points
#  * [[lat1, lon1], [lat2, lon2], ...]
#  */
# function polygonToPoints(dataFeature) {
#   let points = []

#   // How to flatten array: https://stackoverflow.com/a/10865042
#   let flattenedCoords = flatten(dataFeature.geometry.coordinates)

#   let lons = flattenedCoords.map(entry => entry[0])
#   let lats = flattenedCoords.map(entry => entry[1])
  
#   let bounds = {
#     minLat: Math.min(...lats),
#     maxLat: Math.max(...lats),
#     minLon: Math.min(...lons),
#     maxLon: Math.max(...lons),
  
#   }

#   let stepSize = 0.01

#   for (let lat = bounds.minLat; lat <= bounds.maxLat; lat += stepSize) {
#     for (let lon = bounds.minLon; lon <= bounds.maxLon; lon += stepSize) {
#       if (d3Geo.geoContains(dataFeature, [lon, lat])) {
#         points.push([lon, lat])
#       }
#     }
#   }


#   return points
# }

def geoContains(poly, coord):    
    point = shapely.geometry.Point(coord[0], coord[1])
    # polygon = shapely.geometry.polygon.Polygon([(polycoord[0], polycoord[1]) for polycoord in poly])
    # print(coord)
    # print([(polycoord[0], polycoord[1]) for polycoord in poly])
    return poly.contains(point)

def polygonToPoints(dataFeature):
    points = []

    flattenedCoords = flatten(dataFeature["geometry"]["coordinates"])

    lons = [entry[0] for entry in flattenedCoords]
    lats = [entry[1] for entry in flattenedCoords]
    
    minLat = min(lats)
    maxLat = max(lats)
    minLon = min(lons)
    maxLon = max(lons)

    # if maxLat < 38.54:
    #     return points

    # print(minLat)
    # print(maxLat)

    scale = 100
    stepSize = 1 / scale

    poly = shapely.geometry.polygon.Polygon([(polycoord[0], polycoord[1]) for polycoord in flattenedCoords])
    for lat in range(int(scale * minLat), int(scale * (maxLat + 1)), int(scale * stepSize)):
        for lon in range(int(scale * minLon), int(scale * (maxLon + 1)), int(scale * stepSize)):
            if geoContains(poly, [lon / scale, lat / scale]):
                points.append([lon / scale, lat / scale])

    return points

# /**
#  * 
#  * returns array of array of hexids and avgProperty, ordered by resolution
#  * [
#  *  [[hexId1, avgProperties1], [hexId2, avgProperties2], ...],    // lowest resolution, larger hexagons
#  *  [[hexId1, avgProperties1], [hexId2, avgProperties2], ...],
#  *  [[hexId1, avgProperties1], [hexId2, avgProperties2], ...],    // highest resoultion, smaller hexagons
#  * ]
#  */
# function gridPointsToHexPoints(gridPoints, averageFn, resRange) {

#   let resPoints = []
#   let [minRes, maxRes] = resRange

#   for (let res = minRes; res <= maxRes; res++) {
    
#     let binnedPoints = {}

#     gridPoints.forEach(point => {
#       let hexId = h3.latLngToCell(point[1], point[0], res)

#       if (hexId in binnedPoints) {
#         binnedPoints[hexId].push(point[2])
#       }
#       else {
#         binnedPoints[hexId] = [ point[2] ]
#       }
#     })

#     let points = []

#     for (let hexId in binnedPoints) {
#       points.push([hexId, averageFn(binnedPoints[hexId], hexId)])
#     }

#     resPoints.push(points)
#   }

#   return resPoints
# }

def gridPointsToHexPoints(gridPoints, averageFn, resRange):
    resPoints = []

    minRes, maxRes = resRange

    im = Image.open('elevcorr.png', 'r')
    imwidth, imheight = im.size
    pixel_values = list(im.getdata())
    
    for res in range(minRes, maxRes + 1):
        binnedPoints = {}

        for point in gridPoints:
            lon, lat = point["centroid"]["coordinates"][0], point["centroid"]["coordinates"][1]

            hexId = h3.latlng_to_cell(lat, lon, res)

            pointProps = {
                "confidence": point["confidence"],
                "power": point["power"],
            }

            if hexId in binnedPoints:
                binnedPoints[hexId].append(pointProps)
            else:
                binnedPoints[hexId] = [ pointProps ]

        points = {}

        idd = 0

        for hexId in binnedPoints:
            lat, lon = h3.cell_to_latlng(hexId)
            x, y = latlngToMerc(lat, lon)

            x = math.floor(x * imwidth)
            y = math.floor(y * imheight)

            (r, g, b, _) = pixel_values[imwidth * y + x]
            elev = ((r * 256 + g * 1 + b * 1 / 256) - 32768)
            
            avgObj = averageFn(binnedPoints[hexId])

            avgObj["Elevation"] = elev
            avgObj["personnel"] = random.random() if random.random() < 0.15 else 0
            
            points[hexId] = avgObj

            idd += 1

        resPoints.append(points)

    return resPoints
 
# Opening JSON file
with open("wildfire.json") as wildfire_file:
 
    # Reading from json file
    wildfire_arr = ujson.load(wildfire_file)
        
    with open("wildfire_hex_res.json", "w") as outfile:

        hex_object = gridPointsToHexPoints(wildfire_arr, avgObject, [7, 9])

        ujson.dump(hex_object, outfile)