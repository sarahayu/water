
import { CompositeLayer, SolidPolygonLayer } from "deck.gl"
import * as d3Geo from 'd3-geo'
import * as h3 from 'h3-js'
import { lerp } from '@math.gl/core'

function scaleBounds (hexId, paths, value = 1) {

  // if(!outside) return

  // get center and distance to lerp from
  const dist = value
  const [centerLat, centerLng] = h3.cellToLatLng(hexId)

  // lerp each vertex
  let scaledPaths = paths.map(v => {
      let v1Lng = lerp(centerLng, v[0], dist)
      let v1Lat = lerp(centerLat, v[1], dist)

      return [v1Lng, v1Lat]
  })

  return scaledPaths
}

function createBorderPolygons (borderingBounds, scaledBounds) {

  let polygons = []

  for (let idx = 0; idx < borderingBounds.length; idx++) {

      let polygon = []

      polygon.push(scaledBounds[idx][1])
      polygon.push(scaledBounds[idx][0])
      polygon.push(borderingBounds[idx][0])
      polygon.push(borderingBounds[idx][1])
      
      polygons.push(polygon)
  }

  return polygons
}

function calcPolyBorder (hexId, [thicknessMin, thicknessMax]) {

  // calc hexagonal tile outline boundary
  let bounds = h3.cellToBoundary(hexId).map(p => [p[1], p[0]])

  // scale bounds and create polygons
  let scaledBoundsOuter = scaleBounds(hexId, bounds, thicknessMax)
  let scaledBoundsInner = scaleBounds(hexId, bounds, thicknessMin)
  // let borderPolygons = createBorderPolygons(scaledBoundsOuter, scaledBoundsInner)

  return [scaledBoundsOuter, scaledBoundsInner]
}

function avg(arr) {
  return arr.reduce((a, b) => a + b) / arr.length
}

function flatten(arr) {  
  return [].concat.apply([], arr)
}

/**
 * 
 * returns array of points
 * [[lat1, lon1], [lat2, lon2], ...]
 */
function polygonToPoints(dataFeature) {
  let points = []

  // How to flatten array: https://stackoverflow.com/a/10865042
  let flattenedCoords = flatten(dataFeature.geometry.coordinates)

  let lons = flattenedCoords.map(entry => entry[0])
  let lats = flattenedCoords.map(entry => entry[1])
  
  let bounds = {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLon: Math.min(...lons),
    maxLon: Math.max(...lons),
  
  }

  let stepSize = 0.0005

  for (let lat = bounds.minLat; lat <= bounds.maxLat; lat += stepSize) {
    for (let lon = bounds.minLon; lon <= bounds.maxLon; lon += stepSize) {
      if (d3Geo.geoContains(dataFeature, [lon, lat])) {
        points.push([lon, lat])
      }
    }
  }


  return points
}

/**
 * 
 * returns array of points and properties
 * [[lat1, lon1, properties1], [lat2, lon2, properties2], ...]
 */
export function geojsonToGridPoints(dataFeatures) {
  let points = []

  dataFeatures.forEach(feature => {
    let regionPoints = polygonToPoints(feature)
    points.push(...regionPoints.map(coord => [...coord, feature.properties]))
  })

  return points
}

/**
 * 
 * returns array of hexids and avgProperty
 * [[hexId1, avgProperty1], [hexId2, avgProperty2], ...]
 */
function gridPointsToHexPoints(gridPoints, prop) {
  let binnedPoints = {}

  gridPoints.forEach(point => {
    let hexId = h3.latLngToCell(point[1], point[0], 8)

    if (hexId in binnedPoints) {
      binnedPoints[hexId].push(point[2][prop])
    }
    else {
      binnedPoints[hexId] = [ point[2][prop] ]
    }
  })

  let points = []

  for (let hexId in binnedPoints) {
    points.push([hexId, avg(binnedPoints[hexId])])
  }

  return points
}

/**
 * 
 * returns array of hexId and growth
 * [[hexId1, growth1], [hexId2, growth2], ...]
 */
function geojsonToHexPoints(dataFeatures) {
  let gridPoints = geojsonToGridPoints(dataFeatures)
  let hexPoints = gridPointsToHexPoints(gridPoints, "growth")
  return hexPoints
}

export default class HexTileBorderLayer extends CompositeLayer {

    renderLayers() {

        let layers = []
        let hextiles = geojsonToHexPoints(this.props.data.features)

        let count = 0

        // hextiles.forEach(tile => {
        //   let tilePolygon = calcPolyBorder(tile[0])

        //   tilePolygon.forEach(polygon => {
        //     layers.push(new SolidPolygonLayer({
        //       id: `${count}`,
        //       data: [polygon],
        //       getPolygon: d => d,
        //       getFillColor: d => COLOR_SCALE(tile[1]),
        //     }))
        //     count++

        //   })

        // })


        let polygons = []

        hextiles.forEach(tile => {

            let tilePolygon = calcPolyBorder(tile[0], this.props.thicknessRange)

            console.log(tilePolygon)
            // tilePolygon = flatten(tilePolygon)

            polygons.push([tilePolygon, tile[1]])
        })

        layers.push(new SolidPolygonLayer({
            id: `${this.props.id}HexTileBorderLayer`,
            data: polygons,
            getPolygon: d => d[0],
            getFillColor: this.props.getFillColor,
            pickable: this.props.pickable,
        }))

        // count++
        // console.log(`${this.props.id}HexTileBorderLayer`)
        return layers
    }
}